/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import * as Rx from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { filter, first, map, switchMap, tap, timeout } from 'rxjs';
import { FtrProviderContext } from '../ftr_provider_context';

export default function ({ getService }: FtrProviderContext) {
  const spacesService = getService('spaces');
  const kibanaServer = getService('kibanaServer');
  const reportingAPI = getService('reportingAPI');
  const supertest = getService('supertest');
  const log = getService('log');

  const setSpaceConfig = async (spaceId: string, settings: object) => {
    return await kibanaServer.request({
      path: `/s/${spaceId}/internal/kibana/settings`,
      method: 'POST',
      body: { changes: settings },
    });
  };

  const getCompleted$ = (downloadPath: string) => {
    return Rx.interval(2000).pipe(
      tap(() => log.debug(`checking report status at ${downloadPath}...`)),
      switchMap(() => supertest.get(downloadPath)),
      filter(({ status: statusCode }) => statusCode === 200),
      tap(() => log.debug(`report at ${downloadPath} is done`)),
      map((response) => response.text),
      first(),
      timeout(120000)
    );
  };

  describe('Exports and Spaces', () => {
    const id = 'non_default_space';
    before(async () => {
      await spacesService.create({ id, name: id });
      await kibanaServer.importExport.load(
        `x-pack/test/functional/fixtures/kbn_archiver/reporting/ecommerce_kibana_non_default_space`,
        { space: id }
      );
      await reportingAPI.initEcommerce();
    });

    after(async () => {
      await reportingAPI.teardownEcommerce();
      await reportingAPI.deleteAllReports();
      await spacesService.delete(id);
    });

    /*
     * NOTE: All timestamps in the documents are midnight UTC.
     * "00:00:00.000" means the time is formatted in UTC timezone
     */
    describe('CSV saved search export', () => {
      const JOB_PARAMS_CSV_DEFAULT_SPACE =
        `columns:!(order_date,category,customer_full_name,taxful_total_price,currency),objectType:search,searchSource:(fields:!((field:'*',include_unmapped:true))` +
        `,filter:!((meta:(field:order_date,index:aac3e500-f2c7-11ea-8250-fb138aa491e7,params:()),query:(range:(order_date:(format:strict_date_optional_time,gte:'2019-06-02T12:28:40.866Z'` +
        `,lte:'2019-07-18T20:59:57.136Z'))))),index:aac3e500-f2c7-11ea-8250-fb138aa491e7,parent:(filter:!(),highlightAll:!t,index:aac3e500-f2c7-11ea-8250-fb138aa491e7` +
        `,query:(language:kuery,query:''),version:!t),sort:!((order_date:desc)),trackTotalHits:!t)`;

      const JOB_PARAMS_CSV_NONDEFAULT_SPACE =
        `columns:!(order_date,category,customer_full_name,taxful_total_price,currency),objectType:search,searchSource:(fields:!((field:'*',include_unmapped:true))` +
        `,filter:!((meta:(field:order_date,index:afac7364-c755-5f5c-acd5-8ed6605c5c77,params:()),query:(range:(order_date:(format:strict_date_optional_time` +
        `,gte:'2006-11-04T19:58:58.244Z',lte:'2021-11-04T18:58:58.244Z'))))),index:afac7364-c755-5f5c-acd5-8ed6605c5c77,parent:(filter:!(),highlightAll:!t` +
        `,index:afac7364-c755-5f5c-acd5-8ed6605c5c77,query:(language:kuery,query:''),version:!t),sort:!((order_date:desc)),trackTotalHits:!t)`;

      it('should use formats from the default space', async () => {
        await kibanaServer.uiSettings.update({ 'csv:separator': ',', 'dateFormat:tz': 'UTC' });
        const path = await reportingAPI.postJobJSON(`/api/reporting/generate/csv_searchsource`, {
          jobParams: `(${JOB_PARAMS_CSV_DEFAULT_SPACE},title:'EC SEARCH')`,
        });
        const csv = await lastValueFrom(getCompleted$(path));

        expectSnapshot(csv.slice(0, 500)).toMatchInline(`
          "\\"order_date\\",category,\\"customer_full_name\\",\\"taxful_total_price\\",currency
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Men's Shoes, Men's Clothing, Women's Accessories, Men's Accessories\\",\\"Sultan Al Boone\\",174,EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Women's Shoes, Women's Clothing\\",\\"Pia Richards\\",\\"41.969\\",EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Women's Clothing\\",\\"Brigitte Meyer\\",\\"40.969\\",EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Men's Clothing\\",\\"Abd Mccarthy\\",\\"41.969\\",EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Men's Clothing\\",\\"Robert "
        `);
      });

      it('should use formats from non-default spaces', async () => {
        await setSpaceConfig('non_default_space', {
          'csv:separator': ';',
          'csv:quoteValues': false,
          'dateFormat:tz': 'US/Alaska',
        });
        const path = await reportingAPI.postJobJSON(
          `/s/non_default_space/api/reporting/generate/csv_searchsource`,
          {
            jobParams: `(${JOB_PARAMS_CSV_NONDEFAULT_SPACE},title:'Ecom Search from Non-Default')`,
          }
        );
        const csv = await lastValueFrom(getCompleted$(path));
        expectSnapshot(csv.slice(0, 500)).toMatchInline(`
          "order_date;category;customer_full_name;taxful_total_price;currency
          Jul 11, 2019 @ 16:00:00.000;Men's Shoes, Men's Clothing, Women's Accessories, Men's Accessories;Sultan Al Boone;174;EUR
          Jul 11, 2019 @ 16:00:00.000;Women's Shoes, Women's Clothing;Pia Richards;41.969;EUR
          Jul 11, 2019 @ 16:00:00.000;Women's Clothing;Brigitte Meyer;40.969;EUR
          Jul 11, 2019 @ 16:00:00.000;Men's Clothing;Abd Mccarthy;41.969;EUR
          Jul 11, 2019 @ 16:00:00.000;Men's Clothing;Robert Banks;36.969;EUR
          Jul 11, 2019 @ 16:00:00."
        `);
      });

      it(`should use browserTimezone in jobParams for date formatting`, async () => {
        const tzParam = 'America/Phoenix';
        const tzSettings = 'Browser';
        await setSpaceConfig('non_default_space', {
          'csv:separator': ';',
          'dateFormat:tz': tzSettings,
        });
        const path = await reportingAPI.postJobJSON(`/api/reporting/generate/csv_searchsource`, {
          jobParams: `(browserTimezone:${tzParam},${JOB_PARAMS_CSV_DEFAULT_SPACE},title:'EC SEARCH')`,
        });

        const csv = await lastValueFrom(getCompleted$(path));
        expectSnapshot(csv.slice(0, 500)).toMatchInline(`
          "\\"order_date\\",category,\\"customer_full_name\\",\\"taxful_total_price\\",currency
          \\"Jul 11, 2019 @ 17:00:00.000\\",\\"Men's Shoes, Men's Clothing, Women's Accessories, Men's Accessories\\",\\"Sultan Al Boone\\",174,EUR
          \\"Jul 11, 2019 @ 17:00:00.000\\",\\"Women's Shoes, Women's Clothing\\",\\"Pia Richards\\",\\"41.969\\",EUR
          \\"Jul 11, 2019 @ 17:00:00.000\\",\\"Women's Clothing\\",\\"Brigitte Meyer\\",\\"40.969\\",EUR
          \\"Jul 11, 2019 @ 17:00:00.000\\",\\"Men's Clothing\\",\\"Abd Mccarthy\\",\\"41.969\\",EUR
          \\"Jul 11, 2019 @ 17:00:00.000\\",\\"Men's Clothing\\",\\"Robert "
        `);
      });

      it(`should default to UTC for date formatting when timezone is not known`, async () => {
        await kibanaServer.uiSettings.update({ 'csv:separator': ',', 'dateFormat:tz': 'Browser' });
        const path = await reportingAPI.postJobJSON(`/api/reporting/generate/csv_searchsource`, {
          jobParams: `(${JOB_PARAMS_CSV_DEFAULT_SPACE},title:'EC SEARCH')`,
        });
        const csv = await lastValueFrom(getCompleted$(path));
        expectSnapshot(csv.slice(0, 500)).toMatchInline(`
          "\\"order_date\\",category,\\"customer_full_name\\",\\"taxful_total_price\\",currency
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Men's Shoes, Men's Clothing, Women's Accessories, Men's Accessories\\",\\"Sultan Al Boone\\",174,EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Women's Shoes, Women's Clothing\\",\\"Pia Richards\\",\\"41.969\\",EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Women's Clothing\\",\\"Brigitte Meyer\\",\\"40.969\\",EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Men's Clothing\\",\\"Abd Mccarthy\\",\\"41.969\\",EUR
          \\"Jul 12, 2019 @ 00:00:00.000\\",\\"Men's Clothing\\",\\"Robert "
        `);
      });
    });

    it('should complete a job of PNG export of a dashboard in non-default space', async () => {
      const downloadPath = await reportingAPI.postJobJSON(
        `/s/non_default_space/api/reporting/generate/pngV2`,
        {
          jobParams: `(browserTimezone:UTC,layout:(dimensions:(height:512,width:2402),id:png),locatorParams:(id:DASHBOARD_APP_LOCATOR,params:(dashboardId:e35742df-db88-5bd6-9d35-732b4b04a079,preserveSavedFilters:!t,timeRange:(from:'2019-06-10T03:17:28.800Z',to:'2019-07-14T19:25:06.385Z'),useHash:!f,viewMode:view)),objectType:dashboard,title:'Ecom Dashboard Non Default Space',version:'8.16.0')`,
        }
      );

      const completed$: Rx.Observable<string> = getCompleted$(downloadPath);
      const reportCompleted = await completed$.toPromise();
      expect(reportCompleted).to.not.be(null);
    });

    it('should complete a job of PDF export of a dashboard in non-default space', async () => {
      const downloadPath = await reportingAPI.postJobJSON(
        `/s/non_default_space/api/reporting/generate/printablePdfV2`,
        {
          jobParams: `(browserTimezone:UTC,layout:(dimensions:(height:512,width:2402),id:preserve_layout),locatorParams:!((id:DASHBOARD_APP_LOCATOR,params:(dashboardId:e35742df-db88-5bd6-9d35-732b4b04a079,preserveSavedFilters:!t,timeRange:(from:'2019-06-10T03:17:28.800Z',to:'2019-07-14T19:25:06.385Z'),useHash:!f,viewMode:view))),objectType:dashboard,title:'Ecom Dashboard Non Default Space',version:'8.16.0')`,
        }
      );

      const completed$ = getCompleted$(downloadPath);
      const reportCompleted = await completed$.toPromise();
      expect(reportCompleted).to.not.be(null);
    });
  });
}
