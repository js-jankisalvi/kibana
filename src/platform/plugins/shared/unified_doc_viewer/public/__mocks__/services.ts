/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { analyticsServiceMock } from '@kbn/core-analytics-browser-mocks';
import { dataPluginMock } from '@kbn/data-plugin/public/mocks';
import { coreMock } from '@kbn/core/public/mocks';
import { fieldFormatsMock } from '@kbn/field-formats-plugin/common/mocks';
import { fieldsMetadataPluginPublicMock } from '@kbn/fields-metadata-plugin/public/mocks';
import { uiSettingsServiceMock } from '@kbn/core-ui-settings-browser-mocks';
import { sharePluginMock } from '@kbn/share-plugin/public/mocks';
import type { UnifiedDocViewerServices, UnifiedDocViewerStart } from '../types';
import { Storage } from '@kbn/kibana-utils-plugin/public';
import { DocViewsRegistry } from '@kbn/unified-doc-viewer';
import { notificationServiceMock } from '@kbn/core/public/mocks';

export const mockUnifiedDocViewer: jest.Mocked<UnifiedDocViewerStart> = {
  registry: new DocViewsRegistry(),
};

export const mockUnifiedDocViewerServices: jest.Mocked<UnifiedDocViewerServices> = {
  analytics: analyticsServiceMock.createAnalyticsServiceStart(),
  data: dataPluginMock.createStartContract(),
  fieldFormats: fieldFormatsMock,
  fieldsMetadata: fieldsMetadataPluginPublicMock.createStartContract(),
  toasts: notificationServiceMock.createStartContract().toasts,
  storage: new Storage(localStorage),
  uiSettings: uiSettingsServiceMock.createStartContract(),
  unifiedDocViewer: mockUnifiedDocViewer,
  share: sharePluginMock.createStartContract(),
  core: coreMock.createStart(),
};
