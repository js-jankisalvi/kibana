/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { ValidationFunc, ValidationError } from '../../hook_form_lib';
import { hasMaxLengthString } from '../../../validators/string';
import { hasMaxLengthArray } from '../../../validators/array';
import { ERROR_CODE } from './types';

export const maxLengthField =
  ({
    length = 0,
    message,
  }: {
    length: number;
    message: string | ((err: Partial<ValidationError>) => string);
  }) =>
  (...args: Parameters<ValidationFunc>): ReturnType<ValidationFunc<any, ERROR_CODE>> => {
    const [{ value }] = args;

    // Validate for Arrays
    if (Array.isArray(value)) {
      return hasMaxLengthArray(length)(value)
        ? undefined
        : {
            code: 'ERR_MAX_LENGTH',
            length,
            message: typeof message === 'function' ? message({ length }) : message,
          };
    }

    // Validate for Strings
    return hasMaxLengthString(length)((value as string).trim())
      ? undefined
      : {
          code: 'ERR_MAX_LENGTH',
          length,
          message: typeof message === 'function' ? message({ length }) : message,
        };
  };
