/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TypeOf } from '@kbn/config-schema';

import type { typesRulesResponseSchemaV1, typesRulesResponseBodySchemaV1 } from '..';

export type TypesRulesResponse = TypeOf<typeof typesRulesResponseSchemaV1>;
export type TypesRulesResponseBody = TypeOf<typeof typesRulesResponseBodySchemaV1>;
