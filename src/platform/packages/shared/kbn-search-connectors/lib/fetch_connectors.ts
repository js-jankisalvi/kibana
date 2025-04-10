/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ElasticsearchClient } from '@kbn/core-elasticsearch-server';

import { ConnectorAPIListConnectorsResponse } from '..';

import { Connector } from '../types/connectors';

import { isNotFoundException } from '../utils/identify_exceptions';
import { CRAWLER_SERVICE_TYPE } from '..';

export const fetchConnectorById = async (
  client: ElasticsearchClient,
  connectorId: string
): Promise<Connector | undefined> => {
  try {
    const result = await client.transport.request<Connector>({
      method: 'GET',
      path: `/_connector/${connectorId}`,
    });
    return result;
  } catch (err) {
    if (isNotFoundException(err)) {
      return undefined;
    }
    throw err;
  }
};

export const fetchConnectorByIndexName = async (
  client: ElasticsearchClient,
  indexName: string
): Promise<Connector | undefined> => {
  try {
    const connectorListResult = await client.transport.request<ConnectorAPIListConnectorsResponse>({
      method: 'GET',
      path: `/_connector`,
      querystring: {
        index_name: indexName,
      },
    });
    const result = connectorListResult.count > 0 ? connectorListResult.results[0] : undefined;
    return result;
  } catch (error) {
    throw error;
  }
};

export const fetchConnectors = async (
  client: ElasticsearchClient,
  indexNames?: string[],
  fetchOnlyCrawlers?: boolean,
  searchQuery?: string,
  includeDeleted?: boolean
): Promise<Connector[]> => {
  const q = searchQuery && searchQuery.length > 0 ? searchQuery : undefined;

  const querystring: Record<string, any> = q
    ? {
        query: q,
      }
    : indexNames
    ? {
        index_name: indexNames.join(','),
      }
    : {};

  let hits: Connector[] = [];
  let accumulator: Connector[] = [];

  do {
    const connectorResult = await client.transport.request<ConnectorAPIListConnectorsResponse>({
      method: 'GET',
      path: `/_connector`,
      querystring: {
        ...querystring,
        from: accumulator.length,
        size: 1000,
        include_deleted: includeDeleted,
      },
    });

    hits = connectorResult.results;
    accumulator = accumulator.concat(hits);
  } while (hits.length >= 1000);

  const result = accumulator;

  if (fetchOnlyCrawlers !== undefined) {
    return result.filter((hit) => {
      return !fetchOnlyCrawlers
        ? hit.service_type !== CRAWLER_SERVICE_TYPE
        : hit.service_type === CRAWLER_SERVICE_TYPE;
    });
  }
  return result;
};
