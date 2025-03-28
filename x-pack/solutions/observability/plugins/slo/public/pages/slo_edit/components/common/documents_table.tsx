/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DataLoadingState, UnifiedDataTable } from '@kbn/unified-data-table';
import React, { useCallback, useState } from 'react';
import { DataView } from '@kbn/data-views-plugin/common';
import { i18n } from '@kbn/i18n';
import { CellActionsProvider } from '@kbn/cell-actions';
import { buildDataTableRecordList } from '@kbn/discover-utils';
import { kqlQuerySchema, QuerySchema } from '@kbn/slo-schema';
import { EuiResizableContainer, EuiProgress, EuiCallOut, EuiSpacer } from '@elastic/eui';
import { buildFilter, FILTERS, TimeRange } from '@kbn/es-query';
import { FieldPath, useFormContext } from 'react-hook-form';
import { Serializable } from '@kbn/utility-types';
import { useKibana } from '../../../../hooks/use_kibana';
import { CreateSLOForm } from '../../types';
import { QuerySearchBar } from './query_search_bar';
import { SearchBarProps } from './query_builder';
import { useTableDocs } from './use_table_docs';
import { useFieldSidebar } from './use_field_sidebar';

interface Props {
  searchBarProps: SearchBarProps;
  dataView: DataView;
  name: FieldPath<CreateSLOForm>;
}

export function DocumentsTable({ dataView, name, searchBarProps }: Props) {
  const services = useKibana().services;
  const { setValue, watch } = useFormContext<CreateSLOForm>();

  const filter = watch(name) as QuerySchema;

  const [range, setRange] = useState<TimeRange>({ from: 'now-1d', to: 'now' });
  const [sampleSize, setSampleSize] = useState(100);
  const [columns, setColumns] = useState<string[]>([]);
  const [sizes, setSizes] = useState({
    fieldsPanel: 180,
    documentsPanel: 500,
  });
  const onPanelWidthChange = useCallback((newSizes: Record<string, number>) => {
    setSizes((prevSizes) => ({
      ...prevSizes,
      ...newSizes,
    }));
  }, []);

  const { data, loading, error } = useTableDocs({ dataView, range, sampleSize, name });
  const fieldSideBar = useFieldSidebar({ dataView, columns, setColumns });

  return (
    <>
      <QuerySearchBar {...searchBarProps} range={range} setRange={setRange} isFlyoutOpen={true} />
      {error && !loading && (
        <>
          <EuiSpacer size="xs" />
          <EuiCallOut color="danger">{error?.message}</EuiCallOut>
        </>
      )}
      <EuiResizableContainer
        style={{ height: 'calc(100vh - 300px)' }}
        onPanelWidthChange={onPanelWidthChange}
      >
        {(EuiResizablePanel, EuiResizableButton) => (
          <>
            <EuiResizablePanel
              id="fieldsPanel"
              size={sizes.fieldsPanel}
              minSize="10%"
              tabIndex={0}
              style={{
                paddingLeft: 0,
                paddingRight: 0,
              }}
            >
              {fieldSideBar}
            </EuiResizablePanel>

            <EuiResizableButton indicator="border" />

            <EuiResizablePanel
              id="documentsPanel"
              size={sizes.documentsPanel}
              minSize="200px"
              tabIndex={0}
            >
              <CellActionsProvider
                getTriggerCompatibleActions={services.uiActions.getTriggerCompatibleActions}
              >
                {loading && <EuiProgress size="xs" color="accent" />}
                <UnifiedDataTable
                  rows={buildDataTableRecordList({
                    records: (data?.hits?.hits ?? []) as any,
                    dataView,
                  })}
                  showColumnTokens
                  dataView={dataView}
                  onFilter={(fieldK, val, mode) => {
                    if (fieldK && typeof fieldK !== 'string' && 'name' in fieldK) {
                      const dField = dataView.getFieldByName(fieldK?.name);
                      if (!dField) {
                        return;
                      }
                      const filterN = buildFilter(
                        dataView,
                        dField,
                        FILTERS.PHRASE,
                        mode === '-',
                        false,
                        val as Serializable,
                        null
                      );
                      if (kqlQuerySchema.is(filter)) {
                        setValue(name, {
                          filters: [filterN],
                          kqlQuery: filter,
                        });
                      } else {
                        setValue(name, {
                          ...(filter ?? {}),
                          filters: [filterN],
                        });
                      }
                    }
                  }}
                  services={{
                    theme: services.theme,
                    fieldFormats: services.fieldFormats,
                    uiSettings: services.uiSettings,
                    dataViewFieldEditor: services.dataViewFieldEditor,
                    toastNotifications: services.notifications.toasts,
                    storage: services.storage,
                    data: services.data,
                  }}
                  ariaLabelledBy={i18n.translate('xpack.slo.edit.documentsTableAriaLabel', {
                    defaultMessage: 'Documents table',
                  })}
                  loadingState={loading ? DataLoadingState.loading : DataLoadingState.loaded}
                  columns={columns}
                  onSetColumns={setColumns}
                  showTimeCol={true}
                  sampleSizeState={sampleSize}
                  onUpdateSampleSize={(nSample) => {
                    setSampleSize(nSample);
                  }}
                  sort={[]}
                  showFullScreenButton={false}
                />
              </CellActionsProvider>
            </EuiResizablePanel>
          </>
        )}
      </EuiResizableContainer>
    </>
  );
}
