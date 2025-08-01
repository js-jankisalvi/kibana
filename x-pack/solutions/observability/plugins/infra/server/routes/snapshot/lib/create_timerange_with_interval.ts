/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { uniq } from 'lodash';
import {
  type MetricsUIAggregation,
  type MetricsAPITimerange,
  isBasicMetricAgg,
} from '@kbn/metrics-data-access-plugin/common';
import type { ESSearchClient } from '@kbn/metrics-data-access-plugin/server';
import { calculateMetricInterval } from '../../../utils/calculate_metric_interval';
import type { InfraSnapshotRequestOptions } from './get_metrics_aggregations';
import { getMetricsAggregations } from './get_metrics_aggregations';
import { getDatasetForField } from './get_dataset_for_field';

const DEFAULT_LOOKBACK_SIZE = 5;
const createInterval = async (client: ESSearchClient, options: InfraSnapshotRequestOptions) => {
  const { timerange } = options;

  const aggregations = await getMetricsAggregations(options);
  const modules = await aggregationsToModules(client, aggregations, options);

  return Math.max(
    (await calculateMetricInterval(
      client,
      {
        indexPattern: options.sourceConfiguration.metricAlias,
        timerange: { from: timerange.from, to: timerange.to },
      },
      modules,
      options.nodeType
    )) || 60,
    60
  );
};

export const createTimeRangeWithInterval = async (
  client: ESSearchClient,
  options: InfraSnapshotRequestOptions
): Promise<MetricsAPITimerange> => {
  const { timerange } = options;
  if (timerange.forceInterval) {
    return {
      interval: timerange.interval,
      from: timerange.from,
      to: timerange.to,
    };
  }
  if (timerange.ignoreLookback) {
    return {
      interval: 'modules',
      from: timerange.from,
      to: timerange.to,
    };
  }

  const calculatedInterval = await createInterval(client, options);
  const lookbackSize = Math.max(
    timerange.lookbackSize ?? DEFAULT_LOOKBACK_SIZE,
    DEFAULT_LOOKBACK_SIZE
  );
  return {
    interval: `${calculatedInterval}s`,
    from: timerange.to - calculatedInterval * lookbackSize * 1000, // We need at least 5 buckets worth of data
    to: timerange.to,
  };
};

const aggregationsToModules = async (
  client: ESSearchClient,
  aggregations: MetricsUIAggregation,
  options: InfraSnapshotRequestOptions
): Promise<string[]> => {
  const uniqueFields = Object.values(aggregations)
    .reduce<Array<string | undefined>>((fields, agg) => {
      if (isBasicMetricAgg(agg)) {
        return uniq(fields.concat(Object.values(agg).map((a) => a?.field)));
      }
      return fields;
    }, [])
    .filter((v) => v) as string[];
  const fields = await Promise.all(
    uniqueFields.map(
      async (field) =>
        await getDatasetForField(client, field as string, options.sourceConfiguration.metricAlias, {
          ...options.timerange,
        })
    )
  );
  return fields.filter((f) => f) as string[];
};
