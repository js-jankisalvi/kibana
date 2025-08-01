/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import listingFixture from './fixtures/listing.json';

export default function ({ getService }) {
  const supertest = getService('supertest');
  const esArchiver = getService('esArchiver');

  describe('listing', () => {
    const archive =
      'x-pack/platform/test/fixtures/es_archives/monitoring/singlecluster_yellow_platinum';
    const timeRange = {
      min: '2017-08-29T17:24:17.000Z',
      max: '2017-08-29T17:26:08.000Z',
    };

    before('load archive', () => {
      return esArchiver.load(archive);
    });

    after('unload archive', () => {
      return esArchiver.unload(archive);
    });

    it('should summarize list of kibana instances with stats', async () => {
      const { body } = await supertest
        .post('/api/monitoring/v1/clusters/DFDDUmKHR0Ge0mkdYW2bew/kibana/instances')
        .set('kbn-xsrf', 'xxx')
        .send({ timeRange })
        .expect(200);

      // Fixture is shared between internal and Metricbeat collection tests
      // But timestamps of documents differ by a few miliseconds
      const lastSeenTimestamp = body.kibanas[0].lastSeenTimestamp;
      delete body.kibanas[0].lastSeenTimestamp;

      expect(body).to.eql(listingFixture);
      expect(lastSeenTimestamp).to.eql('2017-08-29T17:25:47.825Z');
    });
  });
}
