/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ConstructorOptions } from '../rules_client';
import { RulesClient } from '../rules_client';
import {
  savedObjectsClientMock,
  loggingSystemMock,
  savedObjectsRepositoryMock,
  uiSettingsServiceMock,
} from '@kbn/core/server/mocks';
import { taskManagerMock } from '@kbn/task-manager-plugin/server/mocks';
import { ruleTypeRegistryMock } from '../../rule_type_registry.mock';
import { alertingAuthorizationMock } from '../../authorization/alerting_authorization.mock';
import { TaskStatus } from '@kbn/task-manager-plugin/server';
import { encryptedSavedObjectsMock } from '@kbn/encrypted-saved-objects-plugin/server/mocks';
import { actionsAuthorizationMock } from '@kbn/actions-plugin/server/mocks';
import type { AlertingAuthorization } from '../../authorization/alerting_authorization';
import type { ActionsAuthorization } from '@kbn/actions-plugin/server';
import { getBeforeSetup } from './lib';
import { ConnectorAdapterRegistry } from '../../connector_adapters/connector_adapter_registry';
import { RULE_SAVED_OBJECT_TYPE } from '../../saved_objects';
import { backfillClientMock } from '../../backfill_client/backfill_client.mock';
import { SavedObjectsErrorHelpers } from '@kbn/core-saved-objects-server';

const taskManager = taskManagerMock.createStart();
const ruleTypeRegistry = ruleTypeRegistryMock.create();
const unsecuredSavedObjectsClient = savedObjectsClientMock.create();

const encryptedSavedObjects = encryptedSavedObjectsMock.createClient();
const authorization = alertingAuthorizationMock.create();
const actionsAuthorization = actionsAuthorizationMock.create();
const internalSavedObjectsRepository = savedObjectsRepositoryMock.create();

const kibanaVersion = 'v7.10.0';
const rulesClientParams: jest.Mocked<ConstructorOptions> = {
  taskManager,
  ruleTypeRegistry,
  unsecuredSavedObjectsClient,
  authorization: authorization as unknown as AlertingAuthorization,
  actionsAuthorization: actionsAuthorization as unknown as ActionsAuthorization,
  spaceId: 'default',
  namespace: 'default',
  maxScheduledPerMinute: 10000,
  minimumScheduleInterval: { value: '1m', enforce: false },
  getUserName: jest.fn(),
  createAPIKey: jest.fn(),
  logger: loggingSystemMock.create().get(),
  internalSavedObjectsRepository,
  encryptedSavedObjectsClient: encryptedSavedObjects,
  getActionsClient: jest.fn(),
  getEventLogClient: jest.fn(),
  kibanaVersion,
  isAuthenticationTypeAPIKey: jest.fn(),
  getAuthenticationAPIKey: jest.fn(),
  connectorAdapterRegistry: new ConnectorAdapterRegistry(),
  getAlertIndicesAlias: jest.fn(),
  alertsService: null,
  backfillClient: backfillClientMock.create(),
  uiSettings: uiSettingsServiceMock.createStartContract(),
  isSystemAction: jest.fn(),
};

beforeEach(() => {
  getBeforeSetup(rulesClientParams, taskManager, ruleTypeRegistry);
});

describe('getAlertState()', () => {
  test('calls saved objects client with given params', async () => {
    const rulesClient = new RulesClient(rulesClientParams);
    unsecuredSavedObjectsClient.get.mockResolvedValueOnce({
      id: '1',
      type: RULE_SAVED_OBJECT_TYPE,
      attributes: {
        alertTypeId: '123',
        schedule: { interval: '10s' },
        params: {
          bar: true,
        },
        executionStatus: {
          status: 'unknown',
          lastExecutionDate: new Date('2020-08-20T19:23:38Z'),
        },
        actions: [
          {
            group: 'default',
            actionRef: 'action_0',
            params: {
              foo: true,
            },
          },
        ],
      },
      references: [
        {
          name: 'action_0',
          type: 'action',
          id: '1',
        },
      ],
    });

    taskManager.get.mockResolvedValueOnce({
      id: '1',
      taskType: 'alerting:123',
      scheduledAt: new Date(),
      attempts: 1,
      status: TaskStatus.Idle,
      runAt: new Date(),
      startedAt: null,
      retryAt: null,
      state: {},
      params: {},
      ownerId: null,
    });

    await rulesClient.getAlertState({ id: '1' });
    expect(unsecuredSavedObjectsClient.get).toHaveBeenCalledTimes(1);
    expect(unsecuredSavedObjectsClient.get.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        "alert",
        "1",
        undefined,
      ]
    `);
  });

  test('gets the underlying task from TaskManager', async () => {
    const rulesClient = new RulesClient(rulesClientParams);

    const scheduledTaskId = 'task-123';

    unsecuredSavedObjectsClient.get.mockResolvedValueOnce({
      id: '1',
      type: RULE_SAVED_OBJECT_TYPE,
      attributes: {
        alertTypeId: '123',
        schedule: { interval: '10s' },
        params: {
          bar: true,
        },
        executionStatus: {
          status: 'unknown',
          lastExecutionDate: new Date('2020-08-20T19:23:38Z'),
        },
        actions: [
          {
            group: 'default',
            actionRef: 'action_0',
            params: {
              foo: true,
            },
          },
        ],
        enabled: true,
        scheduledTaskId,
        mutedInstanceIds: [],
        muteAll: true,
      },
      references: [
        {
          name: 'action_0',
          type: 'action',
          id: '1',
        },
      ],
    });

    taskManager.get.mockResolvedValueOnce({
      id: scheduledTaskId,
      taskType: 'alerting:123',
      scheduledAt: new Date(),
      attempts: 1,
      status: TaskStatus.Idle,
      runAt: new Date(),
      startedAt: null,
      retryAt: null,
      state: {},
      params: {
        alertId: '1',
      },
      ownerId: null,
    });

    await rulesClient.getAlertState({ id: '1' });
    expect(taskManager.get).toHaveBeenCalledTimes(1);
    expect(taskManager.get).toHaveBeenCalledWith(scheduledTaskId);
  });

  test('logs a warning if the task not found', async () => {
    const rulesClient = new RulesClient(rulesClientParams);

    const scheduledTaskId = 'task-123';

    unsecuredSavedObjectsClient.get.mockResolvedValueOnce({
      id: '1',
      type: RULE_SAVED_OBJECT_TYPE,
      attributes: {
        alertTypeId: '123',
        schedule: { interval: '10s' },
        params: {
          bar: true,
        },
        executionStatus: {
          status: 'unknown',
          lastExecutionDate: new Date('2020-08-20T19:23:38Z'),
        },
        actions: [],
        enabled: true,
        scheduledTaskId,
        mutedInstanceIds: [],
        muteAll: true,
      },
      references: [],
    });

    taskManager.get.mockRejectedValueOnce(SavedObjectsErrorHelpers.createGenericNotFoundError());

    await rulesClient.getAlertState({ id: '1' });

    expect(rulesClientParams.logger.warn).toHaveBeenNthCalledWith(2, 'Task (task-123) not found');
  });

  test('logs a warning if the taskManager throws an error', async () => {
    const rulesClient = new RulesClient(rulesClientParams);

    const scheduledTaskId = 'task-123';

    unsecuredSavedObjectsClient.get.mockResolvedValueOnce({
      id: '1',
      type: RULE_SAVED_OBJECT_TYPE,
      attributes: {
        alertTypeId: '123',
        schedule: { interval: '10s' },
        params: {
          bar: true,
        },
        executionStatus: {
          status: 'unknown',
          lastExecutionDate: new Date('2020-08-20T19:23:38Z'),
        },
        actions: [],
        enabled: true,
        scheduledTaskId,
        mutedInstanceIds: [],
        muteAll: true,
      },
      references: [],
    });

    taskManager.get.mockRejectedValueOnce(SavedObjectsErrorHelpers.createBadRequestError());

    await rulesClient.getAlertState({ id: '1' });

    expect(rulesClientParams.logger.warn).toHaveBeenNthCalledWith(
      2,
      'An error occurred when getting the task state for (task-123): Bad Request'
    );
  });

  describe('authorization', () => {
    beforeEach(() => {
      unsecuredSavedObjectsClient.get.mockResolvedValueOnce({
        id: '1',
        type: RULE_SAVED_OBJECT_TYPE,
        attributes: {
          alertTypeId: 'myType',
          consumer: 'myApp',
          schedule: { interval: '10s' },
          params: {
            bar: true,
          },
          enabled: true,
          executionStatus: {
            status: 'unknown',
            lastExecutionDate: new Date('2020-08-20T19:23:38Z'),
          },
          actions: [
            {
              group: 'default',
              actionRef: 'action_0',
              params: {
                foo: true,
              },
            },
          ],
        },
        references: [
          {
            name: 'action_0',
            type: 'action',
            id: '1',
          },
        ],
      });

      taskManager.get.mockResolvedValueOnce({
        id: '1',
        taskType: 'alerting:123',
        scheduledAt: new Date(),
        attempts: 1,
        status: TaskStatus.Idle,
        runAt: new Date(),
        startedAt: null,
        retryAt: null,
        state: {},
        params: {},
        ownerId: null,
      });
    });

    test('ensures user is authorised to get this type of alert under the consumer', async () => {
      const rulesClient = new RulesClient(rulesClientParams);
      await rulesClient.getAlertState({ id: '1' });

      expect(authorization.ensureAuthorized).toHaveBeenCalledWith({
        entity: 'rule',
        consumer: 'myApp',
        operation: 'getRuleState',
        ruleTypeId: 'myType',
      });
    });

    test('throws when user is not authorised to getAlertState this type of alert', async () => {
      const rulesClient = new RulesClient(rulesClientParams);
      // `get` check
      authorization.ensureAuthorized.mockResolvedValueOnce();
      // `getRuleState` check
      authorization.ensureAuthorized.mockRejectedValueOnce(
        new Error(`Unauthorized to getRuleState a "myType" alert for "myApp"`)
      );

      await expect(rulesClient.getAlertState({ id: '1' })).rejects.toMatchInlineSnapshot(
        `[Error: Unauthorized to getRuleState a "myType" alert for "myApp"]`
      );

      expect(authorization.ensureAuthorized).toHaveBeenCalledWith({
        entity: 'rule',
        consumer: 'myApp',
        operation: 'getRuleState',
        ruleTypeId: 'myType',
      });
    });
  });
});
