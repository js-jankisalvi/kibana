/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Observable } from 'rxjs';
import { QUERY_RULE_TYPE_ID, SAVED_QUERY_RULE_TYPE_ID } from '@kbn/securitysolution-rules';
import type { Logger } from '@kbn/core/server';
import { SavedObjectsClient } from '@kbn/core/server';
import type { UsageCounter } from '@kbn/usage-collection-plugin/server';
import { ECS_COMPONENT_TEMPLATE_NAME } from '@kbn/alerting-plugin/server';
import { mappingFromFieldMap } from '@kbn/alerting-plugin/common';
import type { IRuleDataClient } from '@kbn/rule-registry-plugin/server';
import { Dataset } from '@kbn/rule-registry-plugin/server';
import type { ListPluginSetup } from '@kbn/lists-plugin/server';
import type { ILicense } from '@kbn/licensing-plugin/server';
import type { NewPackagePolicy, UpdatePackagePolicy } from '@kbn/fleet-plugin/common';
import { FLEET_ENDPOINT_PACKAGE } from '@kbn/fleet-plugin/common';

import { migrateEndpointDataToSupportSpaces } from './endpoint/migrations/space_awareness_migration';
import { SavedObjectsClientFactory } from './endpoint/services/saved_objects';
import { registerEntityStoreDataViewRefreshTask } from './lib/entity_analytics/entity_store/tasks/data_view_refresh/data_view_refresh_task';
import { ensureIndicesExistsForPolicies } from './endpoint/migrations/ensure_indices_exists_for_policies';
import { CompleteExternalResponseActionsTask } from './endpoint/lib/response_actions';
import { registerAgentRoutes } from './endpoint/routes/agent';
import { endpointPackagePoliciesStatsSearchStrategyProvider } from './search_strategy/endpoint_package_policies_stats';
import { turnOffPolicyProtectionsIfNotSupported } from './endpoint/migrations/turn_off_policy_protections';
import { endpointSearchStrategyProvider } from './search_strategy/endpoint';
import { getScheduleNotificationResponseActionsService } from './lib/detection_engine/rule_response_actions/schedule_notification_response_actions';
import {
  createEqlAlertType,
  createEsqlAlertType,
  createIndicatorMatchAlertType,
  createMlAlertType,
  createNewTermsAlertType,
  createQueryAlertType,
  createThresholdAlertType,
} from './lib/detection_engine/rule_types';
import { initRoutes } from './routes';
import { registerLimitedConcurrencyRoutes } from './routes/limited_concurrency';
import { ManifestConstants, ManifestTask } from './endpoint/lib/artifacts';
import { CheckMetadataTransformsTask } from './endpoint/lib/metadata';
import { initEncryptedSavedObjects, initSavedObjects } from './saved_objects';
import { AppClientFactory } from './client';
import type { ConfigType } from './config';
import { createConfig } from './config';
import { initUiSettings } from './ui_settings';
import { registerDeprecations } from './deprecations';
import {
  APP_ID,
  APP_UI_ID,
  CASE_ATTACHMENT_ENDPOINT_TYPE_ID,
  DEFAULT_ALERTS_INDEX,
  SERVER_APP_ID,
} from '../common/constants';
import { registerEndpointRoutes } from './endpoint/routes/metadata';
import { registerPolicyRoutes } from './endpoint/routes/policy';
import { registerActionRoutes } from './endpoint/routes/actions';
import { registerEndpointSuggestionsRoutes } from './endpoint/routes/suggestions';
import {
  EndpointArtifactClient,
  ManifestManager,
  securityWorkflowInsightsService,
} from './endpoint/services';
import { EndpointAppContextService } from './endpoint/endpoint_app_context_services';
import type { EndpointAppContext } from './endpoint/types';
import { initUsageCollectors } from './usage';
import type { SecuritySolutionRequestHandlerContext } from './types';
import { securitySolutionSearchStrategyProvider } from './search_strategy/security_solution';
import type { ITelemetryEventsSender } from './lib/telemetry/sender';
import { type IAsyncTelemetryEventsSender } from './lib/telemetry/async_sender.types';
import { TelemetryEventsSender } from './lib/telemetry/sender';
import {
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_RETRY_CONFIG,
  AsyncTelemetryEventsSender,
} from './lib/telemetry/async_sender';
import type { ITelemetryReceiver } from './lib/telemetry/receiver';
import { TelemetryReceiver } from './lib/telemetry/receiver';
import { licenseService } from './lib/license';
import { PolicyWatcher } from './endpoint/lib/policy/license_watch';
import previewPolicy from './lib/detection_engine/routes/index/preview_policy.json';
import type { IRuleMonitoringService } from './lib/detection_engine/rule_monitoring';
import { createRuleMonitoringService } from './lib/detection_engine/rule_monitoring';
// eslint-disable-next-line no-restricted-imports
import {
  isLegacyNotificationRuleExecutor,
  legacyRulesNotificationRuleType,
} from './lib/detection_engine/rule_actions_legacy';
import {
  createSecurityRuleTypeWrapper,
  securityRuleTypeFieldMap,
} from './lib/detection_engine/rule_types/create_security_rule_type_wrapper';

import { RequestContextFactory } from './request_context_factory';

import type {
  ISecuritySolutionPlugin,
  PluginInitializerContext,
  SecuritySolutionPluginCoreSetupDependencies,
  SecuritySolutionPluginCoreStartDependencies,
  SecuritySolutionPluginSetup,
  SecuritySolutionPluginSetupDependencies,
  SecuritySolutionPluginStart,
  SecuritySolutionPluginStartDependencies,
} from './plugin_contract';
import { featureUsageService } from './endpoint/services/feature_usage';
import { setIsElasticCloudDeployment } from './lib/telemetry/helpers';
import { artifactService } from './lib/telemetry/artifact';
import { events } from './lib/telemetry/event_based/events';
import { endpointFieldsProvider } from './search_strategy/endpoint_fields';
import {
  ENDPOINT_FIELDS_SEARCH_STRATEGY,
  ENDPOINT_PACKAGE_POLICIES_STATS_STRATEGY,
  ENDPOINT_SEARCH_STRATEGY,
} from '../common/endpoint/constants';

import { ProductFeaturesService } from './lib/product_features_service/product_features_service';
import { registerRiskScoringTask } from './lib/entity_analytics/risk_score/tasks/risk_scoring_task';
import { registerEntityStoreFieldRetentionEnrichTask } from './lib/entity_analytics/entity_store/tasks';
import { registerProtectionUpdatesNoteRoutes } from './endpoint/routes/protection_updates_note';
import {
  latestRiskScoreIndexPattern,
  allRiskScoreIndexPattern,
} from '../common/entity_analytics/risk_engine';
import { isEndpointPackageV2 } from '../common/endpoint/utils/package_v2';
import { assistantTools } from './assistant/tools';
import { turnOffAgentPolicyFeatures } from './endpoint/migrations/turn_off_agent_policy_features';
import { getCriblPackagePolicyPostCreateOrUpdateCallback } from './security_integrations';
import { scheduleEntityAnalyticsMigration } from './lib/entity_analytics/migrations';
import { SiemMigrationsService } from './lib/siem_migrations/siem_migrations_service';
import { TelemetryConfigProvider } from '../common/telemetry_config/telemetry_config_provider';
import { TelemetryConfigWatcher } from './endpoint/lib/policy/telemetry_watch';
import { threatIntelligenceSearchStrategyProvider } from './threat_intelligence/search_strategy';
import {
  CASE_ATTACHMENT_TYPE_ID,
  THREAT_INTELLIGENCE_SEARCH_STRATEGY_NAME,
} from '../common/threat_intelligence/constants';
import { registerPrivilegeMonitoringTask } from './lib/entity_analytics/privilege_monitoring/tasks/privilege_monitoring_task';

export type { SetupPlugins, StartPlugins, PluginSetup, PluginStart } from './plugin_contract';

export class Plugin implements ISecuritySolutionPlugin {
  private readonly pluginContext: PluginInitializerContext;
  private readonly config: ConfigType;
  private readonly logger: Logger;
  private readonly appClientFactory: AppClientFactory;
  private readonly productFeaturesService: ProductFeaturesService;

  private readonly ruleMonitoringService: IRuleMonitoringService;
  private readonly endpointAppContextService = new EndpointAppContextService();
  private readonly siemMigrationsService: SiemMigrationsService;
  private readonly telemetryReceiver: ITelemetryReceiver;
  private readonly telemetryEventsSender: ITelemetryEventsSender;
  private readonly asyncTelemetryEventsSender: IAsyncTelemetryEventsSender;

  private lists: ListPluginSetup | undefined; // TODO: can we create ListPluginStart?
  private licensing$!: Observable<ILicense>;
  private policyWatcher?: PolicyWatcher;
  private telemetryConfigProvider: TelemetryConfigProvider;
  private telemetryWatcher?: TelemetryConfigWatcher;

  private manifestTask: ManifestTask | undefined;
  private completeExternalResponseActionsTask: CompleteExternalResponseActionsTask;
  private checkMetadataTransformsTask: CheckMetadataTransformsTask | undefined;
  private telemetryUsageCounter?: UsageCounter;
  private endpointContext: EndpointAppContext;

  constructor(context: PluginInitializerContext) {
    const serverConfig = createConfig(context);

    this.pluginContext = context;
    this.config = serverConfig;
    this.logger = context.logger.get();
    this.appClientFactory = new AppClientFactory();
    this.productFeaturesService = new ProductFeaturesService(
      this.logger,
      this.config.experimentalFeatures
    );
    this.siemMigrationsService = new SiemMigrationsService(
      this.config,
      this.pluginContext.logger,
      this.pluginContext.env.packageInfo.version
    );

    this.ruleMonitoringService = createRuleMonitoringService(this.config, this.logger);
    this.telemetryEventsSender = new TelemetryEventsSender(
      this.logger,
      this.config.experimentalFeatures
    );
    this.asyncTelemetryEventsSender = new AsyncTelemetryEventsSender(this.logger);
    this.telemetryReceiver = new TelemetryReceiver(this.logger);

    this.telemetryConfigProvider = new TelemetryConfigProvider();

    this.endpointContext = {
      logFactory: this.pluginContext.logger,
      service: this.endpointAppContextService,
      config: (): Promise<ConfigType> => Promise.resolve(this.config),
      get serverConfig() {
        return serverConfig;
      },
      experimentalFeatures: this.config.experimentalFeatures,
    };
    this.completeExternalResponseActionsTask = new CompleteExternalResponseActionsTask({
      endpointAppContext: this.endpointContext,
    });

    this.logger.debug('plugin initialized');
  }

  public setup(
    core: SecuritySolutionPluginCoreSetupDependencies,
    plugins: SecuritySolutionPluginSetupDependencies
  ): SecuritySolutionPluginSetup {
    this.logger.debug('plugin setup');

    const { appClientFactory, productFeaturesService, pluginContext, config, logger } = this;
    const experimentalFeatures = config.experimentalFeatures;

    initSavedObjects(core.savedObjects);
    initEncryptedSavedObjects({
      encryptedSavedObjects: plugins.encryptedSavedObjects,
      logger: this.logger,
    });

    initUiSettings(core.uiSettings, experimentalFeatures, config.enableUiSettingsValidations);
    productFeaturesService.init(plugins.features);

    events.forEach((eventConfig) => {
      core.analytics.registerEventType(eventConfig);
    });

    this.ruleMonitoringService.setup(core, plugins);

    registerDeprecations({ core, config: this.config, logger: this.logger });

    if (experimentalFeatures.riskScoringPersistence) {
      registerRiskScoringTask({
        getStartServices: core.getStartServices,
        kibanaVersion: pluginContext.env.packageInfo.version,
        logger: this.logger,
        auditLogger: plugins.security?.audit.withoutRequest,
        taskManager: plugins.taskManager,
        telemetry: core.analytics,
        entityAnalyticsConfig: config.entityAnalytics,
        experimentalFeatures,
      });
    }

    scheduleEntityAnalyticsMigration({
      getStartServices: core.getStartServices,
      taskManager: plugins.taskManager,
      logger: this.logger,
      auditLogger: plugins.security?.audit.withoutRequest,
      kibanaVersion: pluginContext.env.packageInfo.version,
    }).catch((err) => {
      logger.error(`Error scheduling entity analytics migration: ${err}`);
    });

    if (!experimentalFeatures.entityStoreDisabled) {
      registerEntityStoreFieldRetentionEnrichTask({
        getStartServices: core.getStartServices,
        logger: this.logger,
        telemetry: core.analytics,
        taskManager: plugins.taskManager,
      });

      registerEntityStoreDataViewRefreshTask({
        getStartServices: core.getStartServices,
        appClientFactory,
        logger: this.logger,
        telemetry: core.analytics,
        taskManager: plugins.taskManager,
        auditLogger: plugins.security?.audit.withoutRequest,
        entityStoreConfig: config.entityAnalytics.entityStore,
        experimentalFeatures,
        kibanaVersion: pluginContext.env.packageInfo.version,
      });
    }

    registerPrivilegeMonitoringTask({
      getStartServices: core.getStartServices,
      taskManager: plugins.taskManager,
      logger: this.logger,
      auditLogger: plugins.security?.audit.withoutRequest,
      telemetry: core.analytics,
      kibanaVersion: pluginContext.env.packageInfo.version,
      experimentalFeatures,
    });

    const requestContextFactory = new RequestContextFactory({
      config,
      logger,
      core,
      plugins,
      endpointAppContextService: this.endpointAppContextService,
      ruleMonitoringService: this.ruleMonitoringService,
      siemMigrationsService: this.siemMigrationsService,
      kibanaVersion: pluginContext.env.packageInfo.version,
      kibanaBranch: pluginContext.env.packageInfo.branch,
      buildFlavor: pluginContext.env.packageInfo.buildFlavor,
      productFeaturesService,
    });

    productFeaturesService.registerApiAccessControl(core.http);
    const router = core.http.createRouter<SecuritySolutionRequestHandlerContext>();
    core.http.registerRouteHandlerContext<SecuritySolutionRequestHandlerContext, typeof APP_ID>(
      APP_ID,
      (context, request) => requestContextFactory.create(context, request)
    );

    this.endpointAppContextService.setup({
      securitySolutionRequestContextFactory: requestContextFactory,
      cloud: plugins.cloud,
      loggerFactory: this.pluginContext.logger,
      telemetry: core.analytics,
      httpServiceSetup: core.http,
    });

    initUsageCollectors({
      core,
      eventLogIndex: plugins.eventLog.getIndexPattern(),
      signalsIndex: DEFAULT_ALERTS_INDEX,
      ml: plugins.ml,
      usageCollection: plugins.usageCollection,
      logger,
      riskEngineIndexPatterns: {
        all: allRiskScoreIndexPattern,
        latest: latestRiskScoreIndexPattern,
      },
      legacySignalsIndex: config.signalsIndex,
    });

    this.telemetryUsageCounter = plugins.usageCollection?.createUsageCounter(APP_ID);
    plugins.cases.attachmentFramework.registerExternalReference({
      id: CASE_ATTACHMENT_ENDPOINT_TYPE_ID,
    });

    const { ruleDataService } = plugins.ruleRegistry;
    let ruleDataClient: IRuleDataClient | null = null;
    let previewRuleDataClient: IRuleDataClient | null = null;

    const ruleDataServiceOptions = {
      feature: SERVER_APP_ID,
      registrationContext: 'security',
      dataset: Dataset.alerts,
      componentTemplateRefs: [ECS_COMPONENT_TEMPLATE_NAME],
      componentTemplates: [
        {
          name: 'mappings',
          mappings: mappingFromFieldMap(securityRuleTypeFieldMap, false),
        },
      ],
      secondaryAlias: config.signalsIndex,
    };

    ruleDataClient = ruleDataService.initializeIndex(ruleDataServiceOptions);
    const previewIlmPolicy = previewPolicy.policy;

    const isServerless = this.pluginContext.env.packageInfo.buildFlavor === 'serverless';

    previewRuleDataClient = ruleDataService.initializeIndex({
      ...ruleDataServiceOptions,
      additionalPrefix: '.preview',
      ilmPolicy: previewIlmPolicy,
      secondaryAlias: undefined,
    });

    const securityRuleTypeOptions = {
      lists: plugins.lists,
      docLinks: core.docLinks,
      actions: plugins.actions,
      logger: this.logger,
      config: this.config,
      publicBaseUrl: core.http.basePath.publicBaseUrl,
      ruleDataClient,
      ruleExecutionLoggerFactory:
        this.ruleMonitoringService.createRuleExecutionLogClientForExecutors,
      version: pluginContext.env.packageInfo.version,
      experimentalFeatures: config.experimentalFeatures,
      alerting: plugins.alerting,
      analytics: core.analytics,
      isServerless,
      eventsTelemetry: this.telemetryEventsSender,
      licensing: plugins.licensing,
      scheduleNotificationResponseActionsService: getScheduleNotificationResponseActionsService({
        endpointAppContextService: this.endpointAppContextService,
        osqueryCreateActionService: plugins.osquery?.createActionService,
      }),
    };

    const securityRuleTypeWrapper = createSecurityRuleTypeWrapper(securityRuleTypeOptions);

    plugins.alerting.registerType(securityRuleTypeWrapper(createEqlAlertType()));
    if (!experimentalFeatures.esqlRulesDisabled) {
      plugins.alerting.registerType(securityRuleTypeWrapper(createEsqlAlertType()));
    }
    plugins.alerting.registerType(
      securityRuleTypeWrapper(
        createQueryAlertType({
          id: SAVED_QUERY_RULE_TYPE_ID,
          name: 'Saved Query Rule',
        })
      )
    );
    plugins.alerting.registerType(securityRuleTypeWrapper(createIndicatorMatchAlertType()));
    plugins.alerting.registerType(securityRuleTypeWrapper(createMlAlertType(plugins.ml)));
    plugins.alerting.registerType(
      securityRuleTypeWrapper(
        createQueryAlertType({
          id: QUERY_RULE_TYPE_ID,
          name: 'Custom Query Rule',
        })
      )
    );
    plugins.alerting.registerType(securityRuleTypeWrapper(createThresholdAlertType()));
    plugins.alerting.registerType(securityRuleTypeWrapper(createNewTermsAlertType()));

    // TODO We need to get the endpoint routes inside of initRoutes
    initRoutes(
      router,
      config,
      plugins.encryptedSavedObjects?.canEncrypt === true,
      plugins.security,
      this.telemetryEventsSender,
      plugins.ml,
      ruleDataService,
      logger,
      ruleDataClient,
      core.getStartServices,
      securityRuleTypeOptions,
      previewRuleDataClient,
      this.telemetryReceiver,
      isServerless,
      core.docLinks,
      this.endpointContext
    );

    registerEndpointRoutes(router, this.endpointContext);
    registerEndpointSuggestionsRoutes(
      router,
      plugins.unifiedSearch.autocomplete.getInitializerContextConfig().create(),
      this.endpointContext
    );
    registerLimitedConcurrencyRoutes(core);
    registerPolicyRoutes(router, this.endpointContext);
    registerProtectionUpdatesNoteRoutes(router, this.endpointContext);
    registerActionRoutes(
      router,
      this.endpointContext,
      plugins.encryptedSavedObjects?.canEncrypt === true
    );
    registerAgentRoutes(router, this.endpointContext);

    if (plugins.alerting != null) {
      const ruleNotificationType = legacyRulesNotificationRuleType({ logger });

      if (isLegacyNotificationRuleExecutor(ruleNotificationType)) {
        plugins.alerting.registerType(ruleNotificationType);
      }
    }

    const exceptionListsSetupEnabled = () => {
      return plugins.taskManager && plugins.lists;
    };

    if (exceptionListsSetupEnabled()) {
      this.lists = plugins.lists;
      this.manifestTask = new ManifestTask({
        endpointAppContext: this.endpointContext,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        taskManager: plugins.taskManager!,
      });
    }

    if (plugins.taskManager) {
      this.completeExternalResponseActionsTask.setup({ taskManager: plugins.taskManager });
    }

    core
      .getStartServices()
      .then(async ([coreStart, depsStart]) => {
        appClientFactory.setup({
          getSpaceId: depsStart.spaces?.spacesService?.getSpaceId,
          config,
          kibanaVersion: pluginContext.env.packageInfo.version,
          kibanaBranch: pluginContext.env.packageInfo.branch,
          buildFlavor: pluginContext.env.packageInfo.buildFlavor,
        });

        const endpointFieldsStrategy = endpointFieldsProvider(
          this.endpointAppContextService,
          depsStart.data.indexPatterns
        );
        plugins.data.search.registerSearchStrategy(
          ENDPOINT_FIELDS_SEARCH_STRATEGY,
          endpointFieldsStrategy
        );

        const endpointPackagePoliciesStatsStrategy =
          endpointPackagePoliciesStatsSearchStrategyProvider(this.endpointAppContextService);
        plugins.data.search.registerSearchStrategy(
          ENDPOINT_PACKAGE_POLICIES_STATS_STRATEGY,
          endpointPackagePoliciesStatsStrategy
        );

        const securitySolutionSearchStrategy = securitySolutionSearchStrategyProvider(
          depsStart.data,
          this.endpointContext,
          depsStart.spaces?.spacesService?.getSpaceId,
          ruleDataClient
        );

        plugins.data.search.registerSearchStrategy(
          'securitySolutionSearchStrategy',
          securitySolutionSearchStrategy
        );
        const endpointSearchStrategy = endpointSearchStrategyProvider(
          depsStart.data,
          this.endpointContext
        );

        plugins.data.search.registerSearchStrategy(
          ENDPOINT_SEARCH_STRATEGY,
          endpointSearchStrategy
        );

        const threatIntelligenceSearchStrategy = threatIntelligenceSearchStrategyProvider(
          depsStart.data
        );

        plugins.data.search.registerSearchStrategy(
          THREAT_INTELLIGENCE_SEARCH_STRATEGY_NAME,
          threatIntelligenceSearchStrategy
        );

        plugins.cases.attachmentFramework.registerExternalReference({
          id: CASE_ATTACHMENT_TYPE_ID,
        });

        this.siemMigrationsService.setup({ esClusterClient: coreStart.elasticsearch.client });
      })
      .catch(() => {}); // it shouldn't reject, but just in case

    setIsElasticCloudDeployment(plugins.cloud.isCloudEnabled ?? false);

    this.asyncTelemetryEventsSender.setup(
      DEFAULT_RETRY_CONFIG,
      DEFAULT_QUEUE_CONFIG,
      this.telemetryReceiver,
      plugins.telemetry,
      this.telemetryUsageCounter,
      core.analytics
    );

    this.telemetryEventsSender.setup(
      this.telemetryReceiver,
      plugins.telemetry,
      plugins.taskManager,
      this.telemetryUsageCounter,
      this.asyncTelemetryEventsSender
    );

    this.checkMetadataTransformsTask = new CheckMetadataTransformsTask({
      endpointAppContext: this.endpointContext,
      core,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      taskManager: plugins.taskManager!,
    });

    featureUsageService.setup(plugins.licensing);

    securityWorkflowInsightsService.setup({
      kibanaVersion: pluginContext.env.packageInfo.version,
      logger: this.logger,
      isFeatureEnabled: config.experimentalFeatures.defendInsights,
      endpointContext: this.endpointContext.service,
    });

    return {
      setProductFeaturesConfigurator:
        productFeaturesService.setProductFeaturesConfigurator.bind(productFeaturesService),
      experimentalFeatures: { ...config.experimentalFeatures },
    };
  }

  public start(
    core: SecuritySolutionPluginCoreStartDependencies,
    plugins: SecuritySolutionPluginStartDependencies
  ): SecuritySolutionPluginStart {
    const { config, logger, productFeaturesService } = this;

    this.ruleMonitoringService.start(core, plugins);

    const savedObjectsClient = new SavedObjectsClient(
      core.savedObjects.createInternalRepository([
        ManifestConstants.SAVED_OBJECT_TYPE,
        ManifestConstants.UNIFIED_SAVED_OBJECT_TYPE,
      ])
    );
    const registerIngestCallback = plugins.fleet?.registerExternalCallback;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const exceptionListClient = this.lists!.getExceptionListClient(
      savedObjectsClient,
      'kibana',
      // execution of Lists plugin server extension points callbacks should be turned off
      // here because most of the uses of this client will be in contexts where some endpoint
      // validations (specifically those around authz) can not be done (due ot the lack of a `KibanaRequest`
      // from where authz can be derived)
      false
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fleetStartServices = plugins.fleet!;

    const { packageService } = fleetStartServices;

    this.licensing$ = plugins.licensing.license$;

    this.telemetryConfigProvider.start(plugins.telemetry.isOptedIn$);

    // Assistant Tool and Feature Registration
    plugins.elasticAssistant.registerTools(APP_UI_ID, assistantTools);
    const features = {
      assistantModelEvaluation: config.experimentalFeatures.assistantModelEvaluation,
    };
    plugins.elasticAssistant.registerFeatures(APP_UI_ID, features);
    plugins.elasticAssistant.registerFeatures('management', features);

    const manifestManager = new ManifestManager({
      savedObjectsClientFactory: new SavedObjectsClientFactory(core.savedObjects, core.http),
      savedObjectsClient,
      exceptionListClient,
      artifactClient: new EndpointArtifactClient(
        fleetStartServices.createArtifactsClient('endpoint')
      ),
      packagePolicyService: fleetStartServices.packagePolicyService,
      logger: this.pluginContext.logger.get('ManifestManager'),
      experimentalFeatures: config.experimentalFeatures,
      packagerTaskPackagePolicyUpdateBatchSize: config.packagerTaskPackagePolicyUpdateBatchSize,
      esClient: core.elasticsearch.client.asInternalUser,
      productFeaturesService,
    });

    this.endpointAppContextService.start({
      fleetStartServices,
      security: core.security,
      alerting: plugins.alerting,
      config,
      cases: plugins.cases,
      manifestManager,
      licenseService,
      telemetryConfigProvider: this.telemetryConfigProvider,
      exceptionListsClient: exceptionListClient,
      registerListsServerExtension: this.lists?.registerExtension,
      featureUsageService,
      experimentalFeatures: config.experimentalFeatures,
      esClient: core.elasticsearch.client.asInternalUser,
      productFeaturesService,
      savedObjectsServiceStart: core.savedObjects,
      connectorActions: plugins.actions,
      spacesService: plugins.spaces?.spacesService,
    });

    if (this.lists && plugins.taskManager && plugins.fleet) {
      // Exceptions, Artifacts and Manifests start
      const taskManager = plugins.taskManager;

      plugins.fleet
        .fleetSetupCompleted()
        .then(async () => {
          logger.info('Dependent plugin setup complete');

          if (this.manifestTask) {
            logger.info('Starting ManifestTask');
            await this.manifestTask.start({
              taskManager,
            });
          } else {
            logger.error(new Error('User artifacts task not available.'));
          }

          const fleetServices = this.endpointAppContextService.getInternalFleetServices();

          await turnOffPolicyProtectionsIfNotSupported(
            core.elasticsearch.client.asInternalUser,
            fleetServices,
            productFeaturesService,
            logger
          );

          await turnOffAgentPolicyFeatures(fleetServices, productFeaturesService, logger);

          // Ensure policies have backing DOT indices (We don't need to `await` this.
          // It can run in the background)
          ensureIndicesExistsForPolicies(this.endpointAppContextService).catch(() => {});

          // Migrate endpoint data if space awareness is enabled
          // (We don't need to `await` this. It can run in the background)
          migrateEndpointDataToSupportSpaces(this.endpointAppContextService).catch((e) => {
            logger.error(e);
          });
        })
        .catch(() => {});

      // License related start
      licenseService.start(this.licensing$);

      featureUsageService.start(plugins.licensing);

      this.policyWatcher = new PolicyWatcher(this.endpointAppContextService);
      this.policyWatcher.start(licenseService);

      this.telemetryWatcher = new TelemetryConfigWatcher(
        plugins.fleet.packagePolicyService,
        core.elasticsearch,
        this.endpointAppContextService
      );
      this.telemetryWatcher.start(this.telemetryConfigProvider);
    }

    if (plugins.taskManager) {
      this.completeExternalResponseActionsTask
        .start({
          taskManager: plugins.taskManager,
          esClient: core.elasticsearch.client.asInternalUser,
        })
        .catch(() => {}); // it shouldn't refuse, but just in case
    }

    this.telemetryReceiver
      .start(
        core,
        (type: string) => core.savedObjects.getIndexForType(type),
        DEFAULT_ALERTS_INDEX,
        this.endpointAppContextService,
        exceptionListClient,
        packageService
      )
      .catch(() => {});

    artifactService.start(this.telemetryReceiver).catch(() => {});

    this.asyncTelemetryEventsSender.start(plugins.telemetry);

    this.telemetryEventsSender.start(
      plugins.telemetry,
      plugins.taskManager,
      this.telemetryReceiver
    );

    securityWorkflowInsightsService
      .start({
        esClient: core.elasticsearch.client.asInternalUser,
        registerDefendInsightsCallback: plugins.elasticAssistant.registerCallback,
      })
      .catch(() => {});

    const endpointPkgInstallationPromise = this.endpointContext.service
      .getInternalFleetServices()
      .packages.getInstallation(FLEET_ENDPOINT_PACKAGE);
    Promise.all([endpointPkgInstallationPromise, plugins.fleet?.fleetSetupCompleted()])
      .then(async ([endpointPkgInstallation]) => {
        if (plugins.taskManager) {
          if (
            endpointPkgInstallation?.version &&
            isEndpointPackageV2(endpointPkgInstallation.version)
          ) {
            return;
          }

          await this.checkMetadataTransformsTask?.start({ taskManager: plugins.taskManager });
        }
      })
      .catch(() => {}); // it shouldn't reject, but just in case

    if (registerIngestCallback) {
      registerIngestCallback(
        'packagePolicyCreate',
        async (packagePolicy: NewPackagePolicy): Promise<NewPackagePolicy> => {
          await getCriblPackagePolicyPostCreateOrUpdateCallback(
            core.elasticsearch.client.asInternalUser,
            packagePolicy,
            this.logger
          );
          return packagePolicy;
        }
      );

      registerIngestCallback(
        'packagePolicyUpdate',
        async (packagePolicy: UpdatePackagePolicy): Promise<UpdatePackagePolicy> => {
          await getCriblPackagePolicyPostCreateOrUpdateCallback(
            core.elasticsearch.client.asInternalUser,
            packagePolicy,
            this.logger
          );
          return packagePolicy;
        }
      );
    }

    return {};
  }

  public stop() {
    this.logger.debug('Stopping plugin');
    this.asyncTelemetryEventsSender.stop().catch(() => {});
    this.telemetryEventsSender.stop();
    this.endpointAppContextService.stop();
    this.policyWatcher?.stop();
    this.telemetryWatcher?.stop();
    this.completeExternalResponseActionsTask.stop().catch(() => {});
    this.siemMigrationsService.stop();
    securityWorkflowInsightsService.stop();
    licenseService.stop();
  }
}
