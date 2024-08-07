/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as rt from 'io-ts';
import type { HttpHandler } from '@kbn/core/public';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import { getDatafeedId, getJobId } from '../../../../common/infra_ml';

interface DeleteJobsRequestArgs<JobType extends string> {
  spaceId: string;
  sourceId: string;
  jobTypes: JobType[];
}

export const callDeleteJobs = async <JobType extends string>(
  requestArgs: DeleteJobsRequestArgs<JobType>,
  fetch: HttpHandler
) => {
  const { spaceId, sourceId, jobTypes } = requestArgs;

  // NOTE: Deleting the jobs via this API will delete the datafeeds at the same time
  const deleteJobsResponse = await fetch('/internal/ml/jobs/delete_jobs', {
    method: 'POST',
    version: '1',
    body: JSON.stringify(
      deleteJobsRequestPayloadRT.encode({
        jobIds: jobTypes.map((jobType) => getJobId(spaceId, sourceId, jobType)),
      })
    ),
  });

  return decodeOrThrow(deleteJobsResponsePayloadRT)(deleteJobsResponse);
};

export const callGetJobDeletionTasks = async (fetch: HttpHandler) => {
  const jobDeletionTasksResponse = await fetch('/internal/ml/jobs/blocking_jobs_tasks', {
    version: '1',
  });

  return decodeOrThrow(getJobDeletionTasksResponsePayloadRT)(jobDeletionTasksResponse);
};

interface StopDatafeedsRequestArgs<JobType extends string> {
  spaceId: string;
  sourceId: string;
  jobTypes: JobType[];
}

export const callStopDatafeeds = async <JobType extends string>(
  requestArgs: StopDatafeedsRequestArgs<JobType>,
  fetch: HttpHandler
) => {
  const { spaceId, sourceId, jobTypes } = requestArgs;

  // Stop datafeed due to https://github.com/elastic/kibana/issues/44652
  const stopDatafeedResponse = await fetch('/internal/ml/jobs/stop_datafeeds', {
    method: 'POST',
    version: '1',
    body: JSON.stringify(
      stopDatafeedsRequestPayloadRT.encode({
        datafeedIds: jobTypes.map((jobType) => getDatafeedId(spaceId, sourceId, jobType)),
      })
    ),
  });

  return decodeOrThrow(stopDatafeedsResponsePayloadRT)(stopDatafeedResponse);
};

export const deleteJobsRequestPayloadRT = rt.type({
  jobIds: rt.array(rt.string),
});

export type DeleteJobsRequestPayload = rt.TypeOf<typeof deleteJobsRequestPayloadRT>;

export const deleteJobsResponsePayloadRT = rt.record(
  rt.string,
  rt.type({
    deleted: rt.boolean,
  })
);

export type DeleteJobsResponsePayload = rt.TypeOf<typeof deleteJobsResponsePayloadRT>;

export const getJobDeletionTasksResponsePayloadRT = rt.type({
  jobs: rt.array(rt.record(rt.string, rt.string)),
});

export const stopDatafeedsRequestPayloadRT = rt.type({
  datafeedIds: rt.array(rt.string),
});

export const stopDatafeedsResponsePayloadRT = rt.record(
  rt.string,
  rt.type({
    stopped: rt.boolean,
  })
);
