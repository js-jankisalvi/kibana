/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ELASTIC_HTTP_VERSION_HEADER } from '@kbn/core-http-common';
import { INITIAL_REST_VERSION } from '@kbn/data-views-plugin/server/constants';
import expect from '@kbn/expect';
import { InternalRequestHeader, RoleCredentials } from '../../../../../shared/services';
import type { FtrProviderContext } from '../../../../ftr_provider_context';
import { configArray } from '../../constants';

export default function ({ getService }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const svlCommonApi = getService('svlCommonApi');
  const svlUserManager = getService('svlUserManager');
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  let roleAuthc: RoleCredentials;
  let internalReqHeader: InternalRequestHeader;

  describe('main', () => {
    before(async () => {
      roleAuthc = await svlUserManager.createM2mApiKeyWithRoleScope('admin');
      internalReqHeader = svlCommonApi.getInternalRequestHeader();
      await esArchiver.load(
        'src/platform/test/api_integration/fixtures/es_archiver/index_patterns/basic_index'
      );
    });

    after(async () => {
      await esArchiver.unload(
        'src/platform/test/api_integration/fixtures/es_archiver/index_patterns/basic_index'
      );
      await svlUserManager.invalidateM2mApiKeyWithRoleScope(roleAuthc);
    });

    configArray.forEach((config) => {
      describe(config.name, () => {
        it('can update an existing field', async () => {
          const title = `basic_index`;
          const response1 = await supertestWithoutAuth
            .post(config.path)
            .set(ELASTIC_HTTP_VERSION_HEADER, INITIAL_REST_VERSION)
            .set(internalReqHeader)
            .set(roleAuthc.apiKeyHeader)
            .send({
              override: true,
              [config.serviceKey]: {
                title,
                runtimeFieldMap: {
                  runtimeFoo: {
                    type: 'keyword',
                    script: {
                      source: "doc['field_name'].value",
                    },
                  },
                  runtimeBar: {
                    type: 'keyword',
                    script: {
                      source: "doc['field_name'].value",
                    },
                  },
                },
              },
            });

          const response2 = await supertestWithoutAuth
            .post(`${config.path}/${response1.body[config.serviceKey].id}/runtime_field/runtimeFoo`)
            .set(ELASTIC_HTTP_VERSION_HEADER, INITIAL_REST_VERSION)
            .set(internalReqHeader)
            .set(roleAuthc.apiKeyHeader)
            .send({
              runtimeField: {
                type: 'keyword',
                script: {
                  source: "doc['something_new'].value",
                },
              },
            });

          expect(response2.status).to.be(200);

          const response3 = await supertestWithoutAuth
            .get(`${config.path}/${response1.body[config.serviceKey].id}/runtime_field/runtimeFoo`)
            .set(ELASTIC_HTTP_VERSION_HEADER, INITIAL_REST_VERSION)
            .set(internalReqHeader)
            .set(roleAuthc.apiKeyHeader);

          const field =
            config.serviceKey === 'index_pattern' ? response3.body.field : response3.body.fields[0];

          expect(response3.status).to.be(200);
          expect(response3.body[config.serviceKey]).to.not.be.empty();
          expect(field.type).to.be('string');
          expect(field.runtimeField.type).to.be('keyword');
          expect(field.runtimeField.script.source).to.be("doc['something_new'].value");

          // Partial update
          const response4 = await supertestWithoutAuth
            .post(`${config.path}/${response1.body[config.serviceKey].id}/runtime_field/runtimeFoo`)
            .set(ELASTIC_HTTP_VERSION_HEADER, INITIAL_REST_VERSION)
            .set(internalReqHeader)
            .set(roleAuthc.apiKeyHeader)
            .send({
              runtimeField: {
                script: {
                  source: "doc['partial_update'].value",
                },
              },
            });

          expect(response4.status).to.be(200);
          const field2 =
            config.serviceKey === 'index_pattern' ? response4.body.field : response4.body.fields[0];

          expect(field2.runtimeField.script.source).to.be("doc['partial_update'].value");
        });
      });
    });
  });
}
