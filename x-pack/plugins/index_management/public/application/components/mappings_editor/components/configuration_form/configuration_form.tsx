/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { EuiSpacer } from '@elastic/eui';

import { FormData } from '@kbn/es-ui-shared-plugin/static/forms/hook_form_lib';
import { useAppContext } from '../../../../app_context';
import { useForm, Form } from '../../shared_imports';
import { GenericObject, MappingsConfiguration } from '../../types';
import { MapperSizePluginId } from '../../constants';
import { useDispatch } from '../../mappings_state_context';
import { DynamicMappingSection } from './dynamic_mapping_section';
import { SourceFieldSection } from './source_field_section';
import { MetaFieldSection } from './meta_field_section';
import { RoutingSection } from './routing_section';
import { MapperSizePluginSection } from './mapper_size_plugin_section';
import { SubobjectsSection } from './subobjects_section';
import { configurationFormSchema } from './configuration_form_schema';

interface Props {
  value?: MappingsConfiguration;
  /** List of plugins installed in the cluster nodes */
  esNodesPlugins: string[];
}

const formSerializer = (formData: GenericObject, sourceFieldMode?: string) => {
  const { dynamicMapping, sourceField, metaField, _routing, _size, subobjects } = formData;

  const dynamic = dynamicMapping?.enabled
    ? true
    : dynamicMapping?.throwErrorsForUnmappedFields
    ? 'strict'
    : dynamicMapping?.enabled;

  const serialized = {
    dynamic,
    numeric_detection: dynamicMapping?.numeric_detection,
    date_detection: dynamicMapping?.date_detection,
    dynamic_date_formats: dynamicMapping?.dynamic_date_formats,
    _source: sourceFieldMode ? { mode: sourceFieldMode } : sourceField,
    _meta: metaField,
    _routing,
    _size,
    subobjects,
  };

  return serialized;
};

const formDeserializer = (formData: GenericObject) => {
  const {
    dynamic,
    /* eslint-disable @typescript-eslint/naming-convention */
    numeric_detection,
    date_detection,
    dynamic_date_formats,
    /* eslint-enable @typescript-eslint/naming-convention */
    _source: { enabled, includes, excludes } = {} as {
      enabled?: boolean;
      includes?: string[];
      excludes?: string[];
    },
    _meta,
    _routing,
    // For the Mapper Size plugin
    _size,
    subobjects,
  } = formData;

  return {
    dynamicMapping: {
      enabled: dynamic === 'strict' ? false : dynamic,
      throwErrorsForUnmappedFields: dynamic === 'strict' ? true : undefined,
      numeric_detection,
      date_detection,
      dynamic_date_formats,
    },
    sourceField: {
      enabled,
      includes,
      excludes,
    },
    metaField: _meta,
    _routing,
    _size,
    subobjects,
  };
};

export const ConfigurationForm = React.memo(({ value, esNodesPlugins }: Props) => {
  const {
    config: { enableMappingsSourceFieldSection },
  } = useAppContext();

  const isMounted = useRef(false);

  const serializerCallback = useCallback(
    (formData: FormData) => formSerializer(formData, value?._source?.mode),
    [value?._source?.mode]
  );

  const { form } = useForm({
    schema: configurationFormSchema,
    serializer: serializerCallback,
    deserializer: formDeserializer,
    defaultValue: value,
    id: 'configurationForm',
    options: { stripUnsetFields: true },
  });
  const dispatch = useDispatch();
  const { subscribe, submit, reset, getFormData } = form;

  const isMapperSizeSectionVisible =
    value?._size !== undefined || esNodesPlugins.includes(MapperSizePluginId);

  useEffect(() => {
    const subscription = subscribe(({ data, isValid, validate }) => {
      dispatch({
        type: 'configuration.update',
        value: {
          data,
          isValid,
          validate,
          submitForm: submit,
        },
      } as any);
    });

    return subscription.unsubscribe;
  }, [dispatch, subscribe, submit]);

  useEffect(() => {
    if (isMounted.current) {
      // If the value has changed (it probably means that we have loaded a new JSON)
      // we need to reset the form to update the fields values.
      reset({ resetValues: true, defaultValue: value });
    }
  }, [value, reset]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;

      // Save a snapshot of the form state so we can get back to it when navigating back to the tab
      const configurationData = getFormData();
      dispatch({ type: 'configuration.save', value: configurationData as any });
    };
  }, [getFormData, dispatch]);

  return (
    <Form
      form={form}
      isInvalid={form.isSubmitted && !form.isValid}
      error={form.getErrors()}
      data-test-subj="advancedConfiguration"
    >
      <DynamicMappingSection />
      <EuiSpacer size="xl" />
      <MetaFieldSection />
      <EuiSpacer size="xl" />
      {enableMappingsSourceFieldSection && !value?._source?.mode && (
        <>
          <SourceFieldSection /> <EuiSpacer size="xl" />
        </>
      )}
      <RoutingSection />
      {isMapperSizeSectionVisible && <MapperSizePluginSection />}
      <EuiSpacer size="xl" />
      <SubobjectsSection />
    </Form>
  );
});
