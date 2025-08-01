/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { ANALYTICS_SAVED_OBJECT_INDEX } from '@kbn/core-saved-objects-server';
import type { SavedObjectsType } from '@kbn/core/server';
import type { MigrateFunctionsObject } from '@kbn/kibana-utils-plugin/common';
import { extractTabsBackfillFn } from '../../common/service/extract_tabs';
import { getAllMigrations } from './search_migrations';
import { SavedSearchTypeDisplayName } from '../../common/constants';
import {
  SCHEMA_SEARCH_V8_8_0,
  SCHEMA_SEARCH_MODEL_VERSION_1,
  SCHEMA_SEARCH_MODEL_VERSION_2,
  SCHEMA_SEARCH_MODEL_VERSION_3,
  SCHEMA_SEARCH_MODEL_VERSION_4,
  SCHEMA_SEARCH_MODEL_VERSION_5,
  SCHEMA_SEARCH_MODEL_VERSION_6,
} from './schema';

export function getSavedSearchObjectType(
  getSearchSourceMigrations: () => MigrateFunctionsObject
): SavedObjectsType {
  return {
    name: 'search',
    indexPattern: ANALYTICS_SAVED_OBJECT_INDEX,
    hidden: false,
    namespaceType: 'multiple-isolated',
    convertToMultiNamespaceTypeVersion: '8.0.0',
    management: {
      icon: 'discoverApp',
      defaultSearchField: 'title',
      displayName: SavedSearchTypeDisplayName,
      importableAndExportable: true,
      getTitle(obj) {
        return obj.attributes.title;
      },
      getInAppUrl(obj) {
        return {
          path: `/app/discover#/view/${encodeURIComponent(obj.id)}`,
          uiCapabilitiesPath: 'discover_v2.show',
        };
      },
    },
    modelVersions: {
      1: {
        changes: [],
        schemas: {
          forwardCompatibility: SCHEMA_SEARCH_MODEL_VERSION_1.extends({}, { unknowns: 'ignore' }),
          create: SCHEMA_SEARCH_MODEL_VERSION_1,
        },
      },
      2: {
        changes: [],
        schemas: {
          forwardCompatibility: SCHEMA_SEARCH_MODEL_VERSION_2.extends({}, { unknowns: 'ignore' }),
          create: SCHEMA_SEARCH_MODEL_VERSION_2,
        },
      },
      3: {
        changes: [],
        schemas: {
          forwardCompatibility: SCHEMA_SEARCH_MODEL_VERSION_3.extends({}, { unknowns: 'ignore' }),
          create: SCHEMA_SEARCH_MODEL_VERSION_3,
        },
      },
      4: {
        changes: [],
        schemas: {
          forwardCompatibility: SCHEMA_SEARCH_MODEL_VERSION_4.extends({}, { unknowns: 'ignore' }),
          create: SCHEMA_SEARCH_MODEL_VERSION_4,
        },
      },
      5: {
        changes: [],
        schemas: {
          forwardCompatibility: SCHEMA_SEARCH_MODEL_VERSION_5.extends({}, { unknowns: 'ignore' }),
          create: SCHEMA_SEARCH_MODEL_VERSION_5,
        },
      },
      6: {
        changes: [
          {
            type: 'data_backfill',
            backfillFn: extractTabsBackfillFn,
          },
        ],
        schemas: {
          forwardCompatibility: SCHEMA_SEARCH_MODEL_VERSION_6.extends({}, { unknowns: 'ignore' }),
          create: SCHEMA_SEARCH_MODEL_VERSION_6,
        },
      },
    },
    mappings: {
      dynamic: false,
      properties: {
        title: { type: 'text' },
        description: { type: 'text' },
      },
    },
    schemas: {
      '8.8.0': SCHEMA_SEARCH_V8_8_0,
    },
    migrations: () => getAllMigrations(getSearchSourceMigrations()),
  };
}
