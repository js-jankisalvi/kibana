/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { stubIndexPattern } from '@kbn/data-plugin/public/stubs';

export const mockPersistedLog = {
  add: jest.fn(),
  get: jest.fn(() => ['response:200']),
};

export const mockPersistedLogFactory = jest.fn<jest.Mocked<typeof mockPersistedLog>, any>(() => {
  return mockPersistedLog;
});

export const mockFetchIndexPatterns = jest
  .fn()
  .mockReturnValue(Promise.resolve([stubIndexPattern]));

jest.mock('@kbn/data-plugin/public/query/persisted_log', () => ({
  PersistedLog: mockPersistedLogFactory,
}));

jest.mock('./fetch_index_patterns', () => ({
  fetchIndexPatterns: mockFetchIndexPatterns,
}));

import _ from 'lodash';
// Using doMock to avoid hoisting so that I can override only the debounce method in lodash
jest.doMock('lodash', () => ({
  ..._,
  debounce: (func: () => any) => func,
}));
