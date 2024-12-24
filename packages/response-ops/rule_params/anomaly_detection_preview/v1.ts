/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { TypeOf, schema } from '@kbn/config-schema';
import { mlAnomalyDetectionParamsSchema as mlAnomalyDetectionParamsSchemaV1 } from '../anomaly_detection/v1';

export const ALERT_PREVIEW_SAMPLE_SIZE = 5;

export const mlAnomalyDetectionAlertPreviewRequestSchema = schema.object({
  alertParams: mlAnomalyDetectionParamsSchemaV1,
  /**
   * Relative time range to look back from now, e.g. 1y, 8m, 15d
   */
  timeRange: schema.string(),
  /**
   * Number of top hits to return
   */
  sampleSize: schema.number({ defaultValue: ALERT_PREVIEW_SAMPLE_SIZE, min: 0 }),
});

export type MlAnomalyDetectionAlertPreviewRequest = TypeOf<
  typeof mlAnomalyDetectionAlertPreviewRequestSchema
>;
