/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { keyBy } from 'lodash';
import { FtrProviderContext } from '../../ftr_provider_context';

export default function ({ getService, getPageObjects }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const browser = getService('browser');
  const retry = getService('retry');
  const log = getService('log');
  const screenshot = getService('screenshots');
  const security = getService('security');
  const PageObjects = getPageObjects(['security', 'common', 'header', 'discover', 'settings']);
  const kibanaServer = getService('kibanaServer');

  describe('dls', function () {
    const customUserName = 'userEast';
    const customRole = 'myroleEast';

    before('initialize tests', async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await esArchiver.loadIfNeeded('x-pack/platform/test/fixtures/es_archives/security/dlstest');
      await browser.setWindowSize(1600, 1000);

      await PageObjects.common.navigateToApp('settings');
      await PageObjects.settings.createIndexPattern('dlstest', null);

      await security.testUser.setRoles(['cluster_security_manager', 'kibana_admin']);
      await PageObjects.settings.navigateTo();
      await PageObjects.security.clickElasticsearchRoles();
    });

    it(`should add new role ${customRole}`, async function () {
      await PageObjects.security.addRole(customRole, {
        elasticsearch: {
          indices: [
            {
              names: ['dlstest'],
              privileges: ['read', 'view_index_metadata'],
              query: '{"match": {"region": "EAST"}}',
            },
          ],
        },
      });
      const roles = keyBy(await PageObjects.security.getElasticsearchRoles(), 'rolename');
      log.debug('actualRoles = %j', roles);
      expect(roles).to.have.key(customRole);
      expect(roles[customRole].reserved).to.be(false);
      await screenshot.take('Security_Roles');
    });

    it(`should add new user ${customUserName}`, async function () {
      await PageObjects.security.createUser({
        username: customUserName,
        password: 'changeme',
        confirm_password: 'changeme',
        full_name: 'dls EAST',
        email: 'dlstest@elastic.com',
        roles: ['kibana_admin', customRole],
      });
      const users = keyBy(await PageObjects.security.getElasticsearchUsers(), 'username');
      log.debug('actualUsers = %j', users);
      expect(users[customUserName].roles).to.eql(['kibana_admin', customRole]);
      expect(users[customUserName].reserved).to.be(false);
    });

    it('user East should only see EAST doc', async function () {
      await PageObjects.security.forceLogout();
      await PageObjects.security.login(customUserName, 'changeme');
      await PageObjects.common.navigateToApp('discover');
      await retry.try(async () => {
        const hitCount = await PageObjects.discover.getHitCount();
        expect(hitCount).to.be('1');
      });
      const rowData = await PageObjects.discover.getDocTableIndex(1);
      expect(rowData).to.contain('EAST');
    });

    after('logout', async () => {
      // NOTE: Logout needs to happen before anything else to avoid flaky behavior
      await PageObjects.security.forceLogout();
      await security.user.delete(customUserName);
      await security.role.delete(customRole);
      await security.testUser.restoreDefaults();
    });
  });
}
