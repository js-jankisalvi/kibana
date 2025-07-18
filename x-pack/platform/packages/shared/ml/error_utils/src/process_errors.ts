/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isPopulatedObject } from '@kbn/ml-is-populated-object';
import type { ErrorType, MLErrorObject } from './types';
import {
  isBoomError,
  isErrorString,
  isErrorMessage,
  isEsErrorBody,
  isMLResponseError,
} from './types';

/**
 * Extract properties of the error object from within the response error
 * coming from Kibana, Elasticsearch, and our own ML messages.
 *
 * @param {ErrorType} error
 * @returns {MLErrorObject}
 */
export const extractErrorProperties = (error: ErrorType): MLErrorObject => {
  // some responses contain raw es errors as part of a bulk response
  // e.g. if some jobs fail the action in a bulk request
  if (isEsErrorBody(error)) {
    return {
      message: error.error.reason ?? '',
      statusCode: error.status,
      fullError: error,
    };
  }

  if (isErrorString(error)) {
    return {
      message: error,
    };
  }

  if (isBoomError(error)) {
    return {
      message: error.output.payload.message,
      statusCode: error.output.payload.statusCode,
    };
  }

  if (error?.body === undefined && !error?.message) {
    return {
      message: '',
    };
  }

  if (typeof error.body === 'string') {
    return {
      message: error.body,
    };
  }

  if (isMLResponseError(error)) {
    if (
      typeof error.body.attributes === 'object' &&
      typeof error.body.attributes.body?.error?.reason === 'string'
    ) {
      const errObj: MLErrorObject = {
        message: error.body.attributes.body.error.reason,
        statusCode: error.body.statusCode,
        fullError: error.body.attributes.body,
      };
      if (
        typeof error.body.attributes.body.error.caused_by === 'object' &&
        (typeof error.body.attributes.body.error.caused_by?.reason === 'string' ||
          typeof error.body.attributes.body.error.caused_by?.caused_by?.reason === 'string')
      ) {
        errObj.causedBy =
          error.body.attributes.body.error.caused_by?.caused_by?.reason ||
          error.body.attributes.body.error.caused_by?.reason ||
          undefined; // Remove 'null' option from the types
      }
      if (
        Array.isArray(error.body.attributes.body.error.root_cause) &&
        typeof error.body.attributes.body.error.root_cause[0] === 'object' &&
        isPopulatedObject(error.body.attributes.body.error.root_cause[0], ['script'])
      ) {
        errObj.causedBy = error.body.attributes.body.error.root_cause[0].script as string;
        errObj.message += `: '${error.body.attributes.body.error.root_cause[0].script}'`;
      }
      return errObj;
    } else {
      return {
        message: error.body.message,
        statusCode: error.body.statusCode,
      };
    }
  }

  if (isErrorMessage(error)) {
    return {
      message: error.message,
    };
  }

  // If all else fail return an empty message instead of JSON.stringify
  return {
    message: '',
  };
};

/**
 * Extract only the error message within the response error
 * coming from Kibana, Elasticsearch, and our own ML messages.
 *
 * @param {ErrorType} error
 * @returns {string}
 */
export const extractErrorMessage = (error: ErrorType): string => {
  const errorObj = extractErrorProperties(error);
  return errorObj.message;
};
