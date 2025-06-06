/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC, PropsWithChildren } from 'react';
import React, { memo } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { EuiDescribedFormGroup, EuiFormRow } from '@elastic/eui';

interface Props {
  isOptional: boolean;
  titleId: string;
}
export const Description: FC<PropsWithChildren<Props>> = memo(
  ({ children, isOptional, titleId }) => {
    const title = i18n.translate(
      'xpack.ml.newJob.wizard.pickFieldsStep.categorizationField.title',
      {
        defaultMessage: 'Categorization field',
      }
    );
    return (
      <EuiDescribedFormGroup
        title={<h3 id={titleId}>{title}</h3>}
        description={
          <>
            {isOptional ? (
              <FormattedMessage
                id="xpack.ml.newJob.wizard.pickFieldsStep.categorizationFieldOptional.description"
                defaultMessage="Optional, for use if analyzing unstructured log data. Using text data types is recommended."
              />
            ) : (
              <FormattedMessage
                id="xpack.ml.newJob.wizard.pickFieldsStep.categorizationField.description"
                defaultMessage="Specifies which field will be categorized. Using text data types is recommended. Categorization works best on machine written log messages, typically logging written by a developer for the purpose of system troubleshooting."
              />
            )}
          </>
        }
      >
        <EuiFormRow>
          <>{children}</>
        </EuiFormRow>
      </EuiDescribedFormGroup>
    );
  }
);
