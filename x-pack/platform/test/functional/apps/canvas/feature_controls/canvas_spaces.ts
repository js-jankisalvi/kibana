/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getPageObjects, getService }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const spacesService = getService('spaces');
  const { common, canvas } = getPageObjects(['common', 'canvas']);
  const appsMenu = getService('appsMenu');
  const testSubjects = getService('testSubjects');
  const kibanaServer = getService('kibanaServer');
  const soInfo = getService('savedObjectInfo');
  const log = getService('log');

  describe('spaces feature controls', function () {
    this.tags(['skipFirefox']);

    before(async () => {
      await esArchiver.loadIfNeeded(
        'x-pack/platform/test/fixtures/es_archives/logstash_functional'
      );
    });

    after(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await soInfo.logSoTypes(log);
    });

    describe('space with no features disabled', () => {
      const canvasDefaultArchive = 'x-pack/test/functional/fixtures/kbn_archiver/canvas/default';

      before(async () => {
        // we need to load the following in every situation as deleting
        // a space deletes all of the associated saved objects
        await kibanaServer.importExport.load(canvasDefaultArchive);

        await spacesService.create({
          id: 'custom_space',
          name: 'custom_space',
          disabledFeatures: [],
        });
      });

      after(async () => {
        await spacesService.delete('custom_space');
        await kibanaServer.importExport.unload(canvasDefaultArchive);
      });

      it('shows canvas navlink', async () => {
        await common.navigateToApp('home', {
          basePath: '/s/custom_space',
        });
        const navLinks = (await appsMenu.readLinks()).map((link) => link.text);
        expect(navLinks).to.contain('Canvas');
      });

      it(`landing page shows "Create new workpad" button`, async () => {
        await common.navigateToActualUrl('canvas', '', {
          ensureCurrentUrl: false,
          shouldLoginIfPrompted: false,
        });
        await canvas.expectCreateWorkpadButtonEnabled();
      });

      it(`allows a workpad to be created`, async () => {
        await common.navigateToActualUrl('canvas', '', {
          ensureCurrentUrl: true,
          shouldLoginIfPrompted: false,
        });

        await testSubjects.click('create-workpad-button');

        await canvas.expectAddElementButton();
      });

      it(`allows a workpad to be edited`, async () => {
        await common.navigateToActualUrl(
          'canvas',
          '/workpad/workpad-1705f884-6224-47de-ba49-ca224fe6ec31',
          {
            ensureCurrentUrl: true,
            shouldLoginIfPrompted: false,
          }
        );

        await canvas.expectAddElementButton();
      });
    });

    describe('space with Canvas disabled', () => {
      const spaceWithCanvasDisabledArchive =
        'x-pack/test/functional/fixtures/kbn_archiver/spaces/disabled_features';

      before(async () => {
        // we need to load the following in every situation as deleting
        // a space deletes all of the associated saved objects
        await kibanaServer.importExport.load(spaceWithCanvasDisabledArchive);
        await spacesService.create({
          id: 'custom_space',
          name: 'custom_space',
          disabledFeatures: ['canvas'],
        });
      });

      after(async () => {
        await spacesService.delete('custom_space');
        await kibanaServer.importExport.unload(spaceWithCanvasDisabledArchive);
      });

      it(`doesn't show canvas navlink`, async () => {
        await common.navigateToApp('home', {
          basePath: '/s/custom_space',
        });
        const navLinks = (await appsMenu.readLinks()).map((link) => link.text);
        expect(navLinks).not.to.contain('Canvas');
      });

      it(`create new workpad returns a 404`, async () => {
        await common.navigateToActualUrl('canvas', '', {
          basePath: '/s/custom_space',
          ensureCurrentUrl: false,
          shouldLoginIfPrompted: false,
        });

        const messageText = await common.getJsonBodyText();
        expect(messageText).to.eql(
          JSON.stringify({
            statusCode: 404,
            error: 'Not Found',
            message: 'Not Found',
          })
        );
      });

      it(`edit workpad returns a 404`, async () => {
        await common.navigateToActualUrl(
          'canvas',
          'workpad/workpad-1705f884-6224-47de-ba49-ca224fe6ec31',
          {
            basePath: '/s/custom_space',
            ensureCurrentUrl: false,
            shouldLoginIfPrompted: false,
          }
        );
        const messageText = await common.getJsonBodyText();
        expect(messageText).to.eql(
          JSON.stringify({
            statusCode: 404,
            error: 'Not Found',
            message: 'Not Found',
          })
        );
      });
    });
  });
}
