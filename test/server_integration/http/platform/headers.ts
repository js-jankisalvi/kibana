/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import Http from 'http';
import Url from 'url';
import { getUrl } from '@kbn/test';
import { FtrProviderContext } from '../../services/types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const oneSec = 1_000;

export default function ({ getService }: FtrProviderContext) {
  const config = getService('config');

  describe('headers timeout ', () => {
    it('handles correctly. See issue #73849', async () => {
      const agent = new Http.Agent({
        keepAlive: true,
      });
      const { protocol, hostname, port } = Url.parse(getUrl.baseUrl(config.get('servers.kibana')));

      function performRequest() {
        return new Promise((resolve, reject) => {
          const req = Http.request(
            {
              protocol,
              hostname,
              port,
              path: '/',
              method: 'GET',
              agent,
            },
            function (res) {
              let data = '';
              res.on('data', (chunk) => {
                data += chunk;
              });
              res.on('end', () => resolve(data));
            }
          );

          req.on('socket', (socket) => {
            socket.write('GET / HTTP/1.1\r\n');
            setTimeout(() => {
              socket.write('Host: localhost\r\n');
            }, oneSec);
            setTimeout(() => {
              // headersTimeout doesn't seem to fire if request headers are sent in one packet.
              socket.write('\r\n');
              req.end();
            }, 2 * oneSec);
          });

          req.on('error', reject);
        });
      }

      await performRequest();
      const defaultHeadersTimeout = 60 * oneSec;
      await delay(defaultHeadersTimeout + oneSec);
      await performRequest();
    });
  });
}
