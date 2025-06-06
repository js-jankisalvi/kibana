/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC } from 'react';
import React, { useMemo } from 'react';
import { css } from '@emotion/react';
import { CHANGE_POINT_DETECTION_VIEW_TYPE } from '@kbn/aiops-change-point-detection/constants';
import { getEsQueryConfig } from '@kbn/data-service';
import { buildEsQuery } from '@kbn/es-query';
import { EuiLoadingSpinner, useEuiTheme } from '@elastic/eui';
import type { ChangePointDetectionProps } from '../../shared_components/change_point_detection';
import { ChangePointsTable } from '../../components/change_point_detection/change_points_table';
import {
  type ChangePointAnnotation,
  type ChangePointDetectionRequestParams,
} from '../../components/change_point_detection/change_point_detection_context';
import { useFilterQueryUpdates } from '../../hooks/use_filters_query';
import { useDataSource } from '../../hooks/use_data_source';
import { useAiopsAppContext } from '../../hooks/use_aiops_app_context';
import { useChangePointResults } from '../../components/change_point_detection/use_change_point_agg_request';
import { ChartsGrid } from '../../components/change_point_detection/charts_grid';
import { NoDataFoundWarning } from '../../components/change_point_detection/no_data_warning';
import { NoChangePointsCallout } from '../../components/change_point_detection/no_change_points_callout';

const defaultSort = {
  field: 'p_value' as keyof ChangePointAnnotation,
  direction: 'asc',
};

/**
 * Grid component wrapper for embeddable.
 *
 * @param timeRange
 * @param fn
 * @param metricField
 * @param maxSeriesToPlot
 * @param splitField
 * @param partitions
 * @constructor
 */
export const ChartGridEmbeddableWrapper: FC<ChangePointDetectionProps> = ({
  viewType = CHANGE_POINT_DETECTION_VIEW_TYPE.CHARTS,
  fn,
  metricField,
  maxSeriesToPlot,
  splitField,
  partitions,
  onError,
  onRenderComplete,
  onChange,
  emptyState,
}) => {
  const { filters, query, searchBounds, interval } = useFilterQueryUpdates();

  const fieldConfig = useMemo(() => {
    return { fn, metricField, splitField };
  }, [fn, metricField, splitField]);

  const { dataView } = useDataSource();
  const { uiSettings } = useAiopsAppContext();
  const { euiTheme } = useEuiTheme();

  const combinedQuery = useMemo(() => {
    const mergedQuery = buildEsQuery(
      dataView,
      query,
      filters,
      uiSettings ? getEsQueryConfig(uiSettings) : undefined
    );
    mergedQuery.bool.filter.push({
      range: {
        [dataView.timeFieldName!]: {
          gte: searchBounds.min?.valueOf(),
          lte: searchBounds.max?.valueOf(),
          format: 'epoch_millis',
        },
      },
    });

    if (Array.isArray(partitions) && partitions.length > 0 && fieldConfig.splitField) {
      mergedQuery.bool?.filter.push({
        terms: {
          [fieldConfig.splitField]: partitions,
        },
      });
    }

    return mergedQuery;
  }, [dataView, fieldConfig.splitField, filters, partitions, query, searchBounds, uiSettings]);

  const requestParams = useMemo<ChangePointDetectionRequestParams>(() => {
    return { interval } as ChangePointDetectionRequestParams;
  }, [interval]);

  const { results, isLoading, isUsingSampleData } = useChangePointResults(
    fieldConfig,
    requestParams,
    combinedQuery,
    10000
  );

  const changePoints = useMemo<ChangePointAnnotation[]>(() => {
    let resultChangePoints: ChangePointAnnotation[] = results.sort((a, b) => {
      if (defaultSort.direction === 'asc') {
        return (a[defaultSort.field] as number) - (b[defaultSort.field] as number);
      } else {
        return (b[defaultSort.field] as number) - (a[defaultSort.field] as number);
      }
    });

    if (maxSeriesToPlot) {
      resultChangePoints = resultChangePoints.slice(0, maxSeriesToPlot);
    }

    if (onChange) {
      onChange(resultChangePoints);
    }

    return resultChangePoints;
  }, [results, maxSeriesToPlot, onChange]);

  if (isLoading) {
    return <EuiLoadingSpinner size="m" />;
  }

  return (
    <div
      css={css`
        overflow: auto;
        width: 100%;
      `}
    >
      {isUsingSampleData && (
        <div css={css({ padding: `${euiTheme.size.s}` })}>
          <NoChangePointsCallout reason={results[0]?.reason} />
        </div>
      )}
      {changePoints.length > 0 ? (
        viewType === CHANGE_POINT_DETECTION_VIEW_TYPE.CHARTS ? (
          <ChartsGrid
            changePoints={changePoints.map((r) => ({ ...r, ...fieldConfig }))}
            interval={requestParams.interval}
            onRenderComplete={onRenderComplete}
          />
        ) : viewType === CHANGE_POINT_DETECTION_VIEW_TYPE.TABLE ? (
          <ChangePointsTable
            isLoading={false}
            annotations={changePoints}
            fieldConfig={fieldConfig}
            onRenderComplete={onRenderComplete}
          />
        ) : null
      ) : !isLoading ? (
        emptyState ? (
          emptyState
        ) : (
          <NoDataFoundWarning onRenderComplete={onRenderComplete} />
        )
      ) : null}
    </div>
  );
};
