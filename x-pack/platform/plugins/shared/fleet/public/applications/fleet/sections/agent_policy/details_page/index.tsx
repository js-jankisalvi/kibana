/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Redirect, useRouteMatch } from 'react-router-dom';
import { Routes, Route } from '@kbn/shared-ux-router';

import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { EuiPortal } from '@elastic/eui';
import type { Props as EuiTabProps } from '@elastic/eui/src/components/tabs/tab';

import type { AgentPolicy, AgentPolicyDetailsDeployAgentAction } from '../../../types';
import { FLEET_ROUTING_PATHS } from '../../../constants';
import {
  AgentPolicyRefreshContext,
  useGetOneAgentPolicy,
  useLink,
  useBreadcrumbs,
  useStartServices,
  useFleetStatus,
  useIntraAppState,
  useUrlParams,
} from '../../../hooks';
import { Loading, Error, AgentEnrollmentFlyout } from '../../../components';
import { WithHeaderLayout } from '../../../layouts';

import {
  PackagePoliciesView,
  SettingsView,
  HeaderRightContent,
  HeaderLeftContent,
} from './components';

export const AgentPolicyDetailsPage: React.FunctionComponent = () => {
  const {
    params: { policyId, tabId = '' },
  } = useRouteMatch<{ policyId: string; tabId?: string }>();
  const { getHref } = useLink();
  const { urlParams } = useUrlParams();
  const showAgentless = urlParams.showAgentless === 'true';

  const agentPolicyRequest = useGetOneAgentPolicy(policyId);
  // If the agent policy is agentless, hide it by default unless `showAgentless` url param is true
  const agentPolicy =
    agentPolicyRequest.data?.item &&
    (!agentPolicyRequest.data.item.supports_agentless || showAgentless)
      ? agentPolicyRequest.data.item
      : null;
  const { isLoading, error, sendRequest: refreshAgentPolicy } = agentPolicyRequest;

  const openEnrollmentFlyoutOpenByDefault = urlParams.openEnrollmentFlyout === 'true';
  const openAddAgentHelpPopoverOpenByDefault = urlParams.showAddAgentHelp === 'true';
  const [redirectToAgentPolicyList] = useState<boolean>(false);
  const [isEnrollmentFlyoutOpen, setIsEnrollmentFlyoutOpen] = useState<boolean>(
    openEnrollmentFlyoutOpenByDefault
  );
  const [isAddAgentHelpPopoverOpen, setIsAddAgentHelpPopoverOpen] = useState<boolean>(
    openAddAgentHelpPopoverOpenByDefault
  );

  const {
    application: { navigateToApp },
  } = useStartServices();
  const routeState = useIntraAppState<AgentPolicyDetailsDeployAgentAction>();

  const { isReady: isFleetReady } = useFleetStatus();

  const onCancelEnrollment = useMemo(() => {
    if (routeState && routeState.onDoneNavigateTo && isFleetReady) {
      const [appId, options] = routeState.onDoneNavigateTo;
      return () => navigateToApp(appId, options);
    }

    return undefined;
  }, [isFleetReady, navigateToApp, routeState]);

  const addAgent = useCallback(() => {
    setIsAddAgentHelpPopoverOpen(false);
    setIsEnrollmentFlyoutOpen(true);
  }, []);

  const headerTabs = useMemo(() => {
    return [
      {
        id: 'integrations',
        name: i18n.translate('xpack.fleet.policyDetails.subTabs.packagePoliciesTabText', {
          defaultMessage: 'Integrations',
        }),
        href: getHref('policy_details', { policyId, tabId: 'integrations' }),
        isSelected: tabId === '' || tabId === 'integrations',
      },
      {
        id: 'settings',
        name: i18n.translate('xpack.fleet.policyDetails.subTabs.settingsTabText', {
          defaultMessage: 'Settings',
        }),
        'data-test-subj': 'agentPolicySettingsTab',
        href: getHref('policy_details', { policyId, tabId: 'settings' }),
        isSelected: tabId === 'settings',
      },
    ];
  }, [getHref, policyId, tabId]);

  const content = useMemo(() => {
    if (redirectToAgentPolicyList) {
      return <Redirect to="/" />;
    }

    if (isLoading) {
      return <Loading />;
    }

    if (error) {
      return (
        <Error
          title={
            <FormattedMessage
              id="xpack.fleet.policyDetails.unexceptedErrorTitle"
              defaultMessage="An error happened while loading the agent policy"
            />
          }
          error={error}
        />
      );
    }

    if (!agentPolicy) {
      return (
        <Error
          title={
            <FormattedMessage
              id="xpack.fleet.policyDetails.unexceptedErrorTitle"
              defaultMessage="An error happened while loading the agent policy"
            />
          }
          error={i18n.translate('xpack.fleet.policyDetails.policyNotFoundErrorTitle', {
            defaultMessage: "Policy ''{id}'' not found",
            values: {
              id: policyId,
            },
          })}
        />
      );
    }

    return (
      <>
        {isEnrollmentFlyoutOpen && (
          <EuiPortal>
            <AgentEnrollmentFlyout
              agentPolicy={agentPolicy}
              onClose={onCancelEnrollment || (() => setIsEnrollmentFlyoutOpen(false))}
            />
          </EuiPortal>
        )}
        <AgentPolicyDetailsContent agentPolicy={agentPolicy} />
      </>
    );
  }, [
    redirectToAgentPolicyList,
    isLoading,
    error,
    agentPolicy,
    isEnrollmentFlyoutOpen,
    onCancelEnrollment,
    policyId,
  ]);
  const headerLeftContent = (
    <HeaderLeftContent agentPolicy={agentPolicy} policyId={policyId} isLoading={isLoading} />
  );
  const headerRightContent = (
    <HeaderRightContent
      agentPolicy={agentPolicy}
      onCancelEnrollment={onCancelEnrollment}
      isLoading={isLoading}
      isAddAgentHelpPopoverOpen={isAddAgentHelpPopoverOpen}
      setIsAddAgentHelpPopoverOpen={setIsAddAgentHelpPopoverOpen}
      addAgent={addAgent}
    />
  );

  return (
    <AgentPolicyRefreshContext.Provider value={{ refresh: refreshAgentPolicy }}>
      <WithHeaderLayout
        leftColumn={headerLeftContent}
        rightColumn={headerRightContent}
        tabs={headerTabs as unknown as EuiTabProps[]}
      >
        {content}
      </WithHeaderLayout>
    </AgentPolicyRefreshContext.Provider>
  );
};

const AgentPolicyDetailsContent: React.FunctionComponent<{ agentPolicy: AgentPolicy }> = ({
  agentPolicy,
}) => {
  useBreadcrumbs('policy_details', { policyName: agentPolicy.name });
  return (
    <Routes>
      <Route
        path={FLEET_ROUTING_PATHS.policy_details_settings}
        render={() => {
          return <SettingsView agentPolicy={agentPolicy} />;
        }}
      />
      <Route
        path={FLEET_ROUTING_PATHS.policy_details}
        render={() => {
          return <PackagePoliciesView agentPolicy={agentPolicy} />;
        }}
      />
    </Routes>
  );
};
