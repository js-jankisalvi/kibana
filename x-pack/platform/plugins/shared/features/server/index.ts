/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { PluginConfigDescriptor, PluginInitializerContext } from '@kbn/core/server';
import type { TypeOf } from '@kbn/config-schema';
import { ConfigSchema } from './config';

// These exports are part of public Features plugin contract, any change in signature of exported
// functions or removal of exports should be considered as a breaking change. Ideally we should
// reduce number of such exports to zero and provide everything we want to expose via Setup/Start
// run-time contracts.
export { uiCapabilitiesRegex } from './feature_schema';

export type {
  KibanaFeatureConfig,
  FeatureKibanaPrivileges,
  ElasticsearchFeatureConfig,
  FeatureElasticsearchPrivileges,
} from '../common';
export type { SubFeaturePrivilegeIterator } from './feature_privilege_iterator';
export { KibanaFeature, ElasticsearchFeature } from '../common';
export type { GetKibanaFeaturesParams } from './feature_registry';
export type { FeaturesPluginSetup, FeaturesPluginStart } from './plugin';

export const config: PluginConfigDescriptor<TypeOf<typeof ConfigSchema>> = { schema: ConfigSchema };
export const plugin = async (initializerContext: PluginInitializerContext) => {
  const { FeaturesPlugin } = await import('./plugin');
  return new FeaturesPlugin(initializerContext);
};
