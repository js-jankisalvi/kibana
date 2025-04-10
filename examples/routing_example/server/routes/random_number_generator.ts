/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { IRouter } from '@kbn/core/server';
import { RANDOM_NUMBER_ROUTE_PATH } from '../../common';

/**
 *
 * @param router Registers a get route that returns a random number between one and ten. It has no input
 * parameters, and returns a random number in the body.
 */
export function registerGetRandomNumberRoute(router: IRouter) {
  router.get(
    {
      path: RANDOM_NUMBER_ROUTE_PATH,
      security: {
        authz: {
          enabled: false,
          reason:
            'This route is opted out of authorization because it is only intended for test use',
        },
      },
      validate: {},
    },
    async (context, request, response) => {
      return response.ok({
        body: {
          randomNumber: Math.random() * 10,
        },
      });
    }
  );
}
