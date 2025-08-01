/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useRef } from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiLoadingSpinner, useEuiTheme } from '@elastic/eui';
import { first } from 'lodash';
import { findInventoryModel } from '@kbn/metrics-data-access-plugin/common';
import type { InventoryItemType, SnapshotMetricType } from '@kbn/metrics-data-access-plugin/common';
import { SnapshotMetricTypeRT } from '@kbn/metrics-data-access-plugin/common';
import { i18n } from '@kbn/i18n';
import { DataSchemaFormat } from '@kbn/metrics-data-access-plugin/common';
import { usePluginConfig } from '../../../../../containers/plugin_config_context';
import { getCustomMetricLabel } from '../../../../../../common/formatters/get_custom_metric_label';
import type { SnapshotCustomMetricInput } from '../../../../../../common/http_api';
import { useSourceContext } from '../../../../../containers/metrics_source';
import type { InfraWaffleMapNode } from '../../../../../common/inventory/types';
import { useSnapshot } from '../../hooks/use_snaphot';
import { createInventoryMetricFormatter } from '../../lib/create_inventory_metric_formatter';
import { getSnapshotMetricTranslations } from '../../../../../../common/inventory_models/intl_strings';
import { useWaffleOptionsContext } from '../../hooks/use_waffle_options';
import { createFormatterForMetric } from '../../../metrics_explorer/components/helpers/create_formatter_for_metric';

export interface Props {
  currentTime: number;
  node: InfraWaffleMapNode;
  nodeType: InventoryItemType;
}

export const ConditionalToolTip = ({ node, nodeType, currentTime }: Props) => {
  const { euiTheme } = useEuiTheme();
  const { sourceId } = useSourceContext();
  // prevents auto-refresh from cancelling ongoing requests to fetch the data for the tooltip
  const requestCurrentTime = useRef(currentTime);
  const model = findInventoryModel(nodeType);
  const { customMetrics } = useWaffleOptionsContext();
  const config = usePluginConfig();

  const requestMetrics = model.metrics
    .getWaffleMapTooltipMetrics({
      schema: config.featureFlags.hostOtelEnabled ? DataSchemaFormat.SEMCONV : DataSchemaFormat.ECS,
    })
    .map((type) => ({ type }))
    .concat(customMetrics) as Array<
    | {
        type: SnapshotMetricType;
      }
    | SnapshotCustomMetricInput
  >;
  const query = JSON.stringify({
    bool: {
      filter: {
        match_phrase: { [model.fields.id]: node.id },
      },
    },
  });
  const { nodes, loading } = useSnapshot({
    filterQuery: query,
    metrics: requestMetrics,
    groupBy: [],
    nodeType,
    sourceId,
    currentTime: requestCurrentTime.current,
    accountId: '',
    region: '',
  });

  const dataNode = first(nodes);
  const metrics = (dataNode && dataNode.metrics) || [];

  return (
    <div
      style={{ minWidth: 220 }}
      data-test-subj={`conditionalTooltipContent-${node.name}`}
      aria-label={node.name}
    >
      <div
        style={{
          borderBottom: `${euiTheme.border.thin}`,
          borderBottomColor: `${euiTheme.colors.mediumShade}`,
          paddingBottom: euiTheme.size.xs,
          marginBottom: euiTheme.size.xs,
        }}
      >
        {node.name}
      </div>
      {loading ? (
        <EuiFlexGroup alignItems="center" justifyContent="center">
          <EuiFlexItem grow={false} data-test-subj="conditionalTooltipContent-loading">
            <EuiLoadingSpinner size="s" />
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : (
        metrics.map((metric) => {
          const metricName = SnapshotMetricTypeRT.is(metric.name) ? metric.name : 'custom';
          const name = getSnapshotMetricTranslations(nodeType)[metricName] || metricName;
          // if custom metric, find field and label from waffleOptionsContext result
          // because useSnapshot does not return it
          const customMetric =
            name === 'custom' ? customMetrics.find((item) => item.id === metric.name) : null;
          const formatter = customMetric
            ? createFormatterForMetric(customMetric)
            : createInventoryMetricFormatter({ type: metricName });

          const metricAriaLabel = i18n.translate('xpack.infra.node.tooltip.ariaLabel', {
            defaultMessage: '{customMetric} : {value}',
            values: {
              customMetric: customMetric ? getCustomMetricLabel(customMetric) : name,
              value: (metric.value && formatter(metric.value)) || '-',
            },
          });
          return (
            <EuiFlexGroup gutterSize="s" key={metric.name} aria-label={metricAriaLabel}>
              <EuiFlexItem
                grow={1}
                className="eui-textTruncate eui-displayBlock"
                data-test-subj="conditionalTooltipContent-metric"
              >
                {customMetric ? getCustomMetricLabel(customMetric) : name}
              </EuiFlexItem>
              <EuiFlexItem grow={false} data-test-subj="conditionalTooltipContent-value">
                {(metric.value && formatter(metric.value)) || '-'}
              </EuiFlexItem>
            </EuiFlexGroup>
          );
        })
      )}
    </div>
  );
};
