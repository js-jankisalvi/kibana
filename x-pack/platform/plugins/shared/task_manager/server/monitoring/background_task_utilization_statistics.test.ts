/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { take, bufferCount, skip, map } from 'rxjs';
import type { ConcreteTaskInstance } from '../task';
import { TaskStatus } from '../task';
import type { TaskTiming, TaskManagerStats } from '../task_events';
import { asTaskRunEvent, TaskPersistence, asTaskManagerStatEvent } from '../task_events';
import { asOk } from '../lib/result_type';
import type { TaskLifecycleEvent } from '../polling_lifecycle';
import { TaskRunResult } from '../task_running';
import type { AggregatedStat } from '../lib/runtime_statistics_aggregator';
import { taskPollingLifecycleMock } from '../polling_lifecycle.mock';
import type { BackgroundTaskUtilizationStat } from './background_task_utilization_statistics';
import {
  createBackgroundTaskUtilizationAggregator,
  summarizeUtilizationStats,
} from './background_task_utilization_statistics';
import { AdHocTaskCounter } from '../lib/adhoc_task_counter';
import { sum, mean } from 'lodash';

describe('Task Run Statistics', () => {
  const pollInterval = 3000;

  beforeAll(() => {
    jest.resetAllMocks();
  });

  describe('createBackgroundTaskUtilizationAggregator', () => {
    test('returns a running count of adhoc actual service_time', async () => {
      const serviceTimes = [1000, 2000, 500, 300, 400, 15000, 20000, 200];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });
      const adHocTaskCounter = new AdHocTaskCounter();

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        adHocTaskCounter,
        pollInterval
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.adhoc.ran.service_time.actual).toEqual(sum(window));
      }

      return new Promise<void>((resolve) => {
        const events = [];
        const now = Date.now();
        for (const time of serviceTimes) {
          events.push({ start: runAtMillisecondsAgo(now, time).getTime(), stop: now });
        }
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          // Use 'summarizeUtilizationStat' to receive summarize stats
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(serviceTimes.length),
          bufferCount(serviceTimes.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], serviceTimes.slice(0, 1));
          expectWindowEqualsUpdate(taskStats[1], serviceTimes.slice(0, 2));
          expectWindowEqualsUpdate(taskStats[2], serviceTimes.slice(0, 3));
          expectWindowEqualsUpdate(taskStats[3], serviceTimes.slice(0, 4));
          expectWindowEqualsUpdate(taskStats[4], serviceTimes.slice(0, 5));
          // from the 6th value, begin to drop old values as out window is 5
          expectWindowEqualsUpdate(taskStats[5], serviceTimes.slice(0, 6));
          expectWindowEqualsUpdate(taskStats[6], serviceTimes.slice(0, 7));
          expectWindowEqualsUpdate(taskStats[7], serviceTimes.slice(0, 8));
          resolve();
        });

        for (const event of events) {
          events$.next(mockTaskRunEvent({}, event));
        }
      });
    });

    test('returns a running count of adhoc adjusted service_time', async () => {
      const serviceTimes = [1000, 2000, 500, 300, 400, 15000, 20000, 200];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });
      const adHocTaskCounter = new AdHocTaskCounter();

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        adHocTaskCounter,
        pollInterval
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.adhoc.ran.service_time.adjusted).toEqual(sum(window));
      }

      return new Promise<void>((resolve) => {
        const events = [];
        const now = Date.now();
        for (const time of serviceTimes) {
          events.push({ start: runAtMillisecondsAgo(now, time).getTime(), stop: now });
        }
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          // Use 'summarizeUtilizationStat' to receive summarize stats
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(serviceTimes.length),
          bufferCount(serviceTimes.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], roundUpToNearestSec(serviceTimes.slice(0, 1), 3));
          expectWindowEqualsUpdate(taskStats[1], roundUpToNearestSec(serviceTimes.slice(0, 2), 3));
          expectWindowEqualsUpdate(taskStats[2], roundUpToNearestSec(serviceTimes.slice(0, 3), 3));
          expectWindowEqualsUpdate(taskStats[3], roundUpToNearestSec(serviceTimes.slice(0, 4), 3));
          expectWindowEqualsUpdate(taskStats[4], roundUpToNearestSec(serviceTimes.slice(0, 5), 3));
          // from the 6th value, begin to drop old values as out window is 5
          expectWindowEqualsUpdate(taskStats[5], roundUpToNearestSec(serviceTimes.slice(0, 6), 3));
          expectWindowEqualsUpdate(taskStats[6], roundUpToNearestSec(serviceTimes.slice(0, 7), 3));
          expectWindowEqualsUpdate(taskStats[7], roundUpToNearestSec(serviceTimes.slice(0, 8), 3));
          resolve();
        });

        for (const event of events) {
          events$.next(mockTaskRunEvent({}, event));
        }
      });
    });

    test('returns a running count of adhoc task_counter', async () => {
      const tasks = [0, 0, 0, 0, 0, 0, 0, 0];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });
      const adHocTaskCounter = new AdHocTaskCounter();

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        adHocTaskCounter,
        pollInterval
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.adhoc.ran.service_time.task_counter).toEqual(window.length);
      }

      return new Promise<void>((resolve) => {
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          // Use 'summarizeUtilizationStat' to receive summarize stats
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(tasks.length),
          bufferCount(tasks.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], tasks.slice(0, 1));
          expectWindowEqualsUpdate(taskStats[1], tasks.slice(0, 2));
          expectWindowEqualsUpdate(taskStats[2], tasks.slice(0, 3));
          expectWindowEqualsUpdate(taskStats[3], tasks.slice(0, 4));
          expectWindowEqualsUpdate(taskStats[4], tasks.slice(0, 5));
          // from the 6th value, begin to drop old values as out window is 5
          expectWindowEqualsUpdate(taskStats[5], tasks.slice(0, 6));
          expectWindowEqualsUpdate(taskStats[6], tasks.slice(0, 7));
          expectWindowEqualsUpdate(taskStats[7], tasks.slice(0, 8));
          resolve();
        });

        for (const task of tasks) {
          events$.next(mockTaskRunEvent({}, { start: task, stop: task }));
        }
      });
    });

    test('returns a running count of adhoc created counter', async () => {
      const tasks = [1000, 2000, 500, 300, 400, 15000, 20000, 200];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });
      const adHocTaskCounter = new AdHocTaskCounter();

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        adHocTaskCounter,
        pollInterval
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.adhoc.created.counter).toEqual(sum(window));
      }

      return new Promise<void>((resolve) => {
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          // Use 'summarizeUtilizationStat' to receive summarize stats
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(tasks.length),
          bufferCount(tasks.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], tasks.slice(0, 1));
          expectWindowEqualsUpdate(taskStats[1], tasks.slice(0, 2));
          expectWindowEqualsUpdate(taskStats[2], tasks.slice(0, 3));
          expectWindowEqualsUpdate(taskStats[3], tasks.slice(0, 4));
          expectWindowEqualsUpdate(taskStats[4], tasks.slice(0, 5));
          // from the 6th value, begin to drop old values as out window is 5
          expectWindowEqualsUpdate(taskStats[5], tasks.slice(0, 6));
          expectWindowEqualsUpdate(taskStats[6], tasks.slice(0, 7));
          expectWindowEqualsUpdate(taskStats[7], tasks.slice(0, 8));
          resolve();
        });

        for (const task of tasks) {
          adHocTaskCounter.increment(task);
          events$.next(mockTaskRunEvent({}, { start: 0, stop: 0 }));
        }
      });
    });

    test('returns a running count of recurring actual service_time', async () => {
      const serviceTimes = [1000, 2000, 500, 300, 400, 15000, 20000, 200];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });
      const adHocTaskCounter = new AdHocTaskCounter();

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        adHocTaskCounter,
        pollInterval
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.recurring.ran.service_time.actual).toEqual(sum(window));
      }

      return new Promise<void>((resolve) => {
        const events = [];
        const now = Date.now();
        for (const time of serviceTimes) {
          events.push({ start: runAtMillisecondsAgo(now, time).getTime(), stop: now });
        }
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          // Use 'summarizeUtilizationStat' to receive summarize stats
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(serviceTimes.length),
          bufferCount(serviceTimes.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], serviceTimes.slice(0, 1));
          expectWindowEqualsUpdate(taskStats[1], serviceTimes.slice(0, 2));
          expectWindowEqualsUpdate(taskStats[2], serviceTimes.slice(0, 3));
          expectWindowEqualsUpdate(taskStats[3], serviceTimes.slice(0, 4));
          expectWindowEqualsUpdate(taskStats[4], serviceTimes.slice(0, 5));
          // from the 6th value, begin to drop old values as out window is 5
          expectWindowEqualsUpdate(taskStats[5], serviceTimes.slice(0, 6));
          expectWindowEqualsUpdate(taskStats[6], serviceTimes.slice(0, 7));
          expectWindowEqualsUpdate(taskStats[7], serviceTimes.slice(0, 8));
          resolve();
        });

        for (const event of events) {
          events$.next(mockTaskRunEvent({ schedule: { interval: '1h' } }, event));
        }
      });
    });

    test('returns a running count of recurring adjusted service_time', async () => {
      const serviceTimes = [1000, 2000, 500, 300, 400, 15000, 20000, 200];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });
      const adHocTaskCounter = new AdHocTaskCounter();

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        adHocTaskCounter,
        pollInterval
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.recurring.ran.service_time.adjusted).toEqual(sum(window));
      }

      return new Promise<void>((resolve) => {
        const events = [];
        const now = Date.now();
        for (const time of serviceTimes) {
          events.push({ start: runAtMillisecondsAgo(now, time).getTime(), stop: now });
        }
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          // Use 'summarizeUtilizationStat' to receive summarize stats
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(serviceTimes.length),
          bufferCount(serviceTimes.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], roundUpToNearestSec(serviceTimes.slice(0, 1), 3));
          expectWindowEqualsUpdate(taskStats[1], roundUpToNearestSec(serviceTimes.slice(0, 2), 3));
          expectWindowEqualsUpdate(taskStats[2], roundUpToNearestSec(serviceTimes.slice(0, 3), 3));
          expectWindowEqualsUpdate(taskStats[3], roundUpToNearestSec(serviceTimes.slice(0, 4), 3));
          expectWindowEqualsUpdate(taskStats[4], roundUpToNearestSec(serviceTimes.slice(0, 5), 3));
          // from the 6th value, begin to drop old values as out window is 5
          expectWindowEqualsUpdate(taskStats[5], roundUpToNearestSec(serviceTimes.slice(0, 6), 3));
          expectWindowEqualsUpdate(taskStats[6], roundUpToNearestSec(serviceTimes.slice(0, 7), 3));
          expectWindowEqualsUpdate(taskStats[7], roundUpToNearestSec(serviceTimes.slice(0, 8), 3));
          resolve();
        });

        for (const event of events) {
          events$.next(mockTaskRunEvent({ schedule: { interval: '1h' } }, event));
        }
      });
    });

    test('returns a running count of recurring task_counter', async () => {
      const tasks = [0, 0, 0, 0, 0, 0, 0, 0];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });
      const adHocTaskCounter = new AdHocTaskCounter();

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        adHocTaskCounter,
        pollInterval
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.recurring.ran.service_time.task_counter).toEqual(window.length);
      }

      return new Promise<void>((resolve) => {
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          // Use 'summarizeUtilizationStat' to receive summarize stats
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(tasks.length),
          bufferCount(tasks.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], tasks.slice(0, 1));
          expectWindowEqualsUpdate(taskStats[1], tasks.slice(0, 2));
          expectWindowEqualsUpdate(taskStats[2], tasks.slice(0, 3));
          expectWindowEqualsUpdate(taskStats[3], tasks.slice(0, 4));
          expectWindowEqualsUpdate(taskStats[4], tasks.slice(0, 5));
          // from the 6th value, begin to drop old values as out window is 5
          expectWindowEqualsUpdate(taskStats[5], tasks.slice(0, 6));
          expectWindowEqualsUpdate(taskStats[6], tasks.slice(0, 7));
          expectWindowEqualsUpdate(taskStats[7], tasks.slice(0, 8));
          resolve();
        });

        for (const task of tasks) {
          events$.next(
            mockTaskRunEvent({ schedule: { interval: '1h' } }, { start: task, stop: task })
          );
        }
      });
    });

    test('returns a running count of load', async () => {
      const loads = [
        40, 80, 100, 100, 10, 10, 60, 40, 40, 80, 100, 100, 10, 10, 60, 40, 40, 80, 100, 100, 10,
        10, 60, 40, 40, 80, 100, 100, 10, 10, 60, 40, 30,
      ];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        new AdHocTaskCounter(),
        500
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.load).toEqual(mean(window));
      }

      return new Promise<void>((resolve) => {
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(loads.length),
          bufferCount(loads.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], loads.slice(0, 1));
          expectWindowEqualsUpdate(taskStats[1], loads.slice(0, 2));
          expectWindowEqualsUpdate(taskStats[2], loads.slice(0, 3));
          expectWindowEqualsUpdate(taskStats[3], loads.slice(0, 4));
          expectWindowEqualsUpdate(taskStats[4], loads.slice(0, 5));
          expectWindowEqualsUpdate(taskStats[5], loads.slice(0, 6));
          expectWindowEqualsUpdate(taskStats[6], loads.slice(0, 7));
          expectWindowEqualsUpdate(taskStats[7], loads.slice(0, 8));
          expectWindowEqualsUpdate(taskStats[8], loads.slice(0, 9));
          expectWindowEqualsUpdate(taskStats[9], loads.slice(0, 10));
          expectWindowEqualsUpdate(taskStats[10], loads.slice(0, 11));
          expectWindowEqualsUpdate(taskStats[11], loads.slice(0, 12));
          expectWindowEqualsUpdate(taskStats[12], loads.slice(0, 13));
          expectWindowEqualsUpdate(taskStats[13], loads.slice(0, 14));
          expectWindowEqualsUpdate(taskStats[14], loads.slice(0, 15));
          expectWindowEqualsUpdate(taskStats[15], loads.slice(0, 16));
          expectWindowEqualsUpdate(taskStats[16], loads.slice(0, 17));
          expectWindowEqualsUpdate(taskStats[17], loads.slice(0, 18));
          expectWindowEqualsUpdate(taskStats[18], loads.slice(0, 19));
          expectWindowEqualsUpdate(taskStats[19], loads.slice(0, 20));
          expectWindowEqualsUpdate(taskStats[20], loads.slice(0, 21));
          expectWindowEqualsUpdate(taskStats[21], loads.slice(0, 22));
          expectWindowEqualsUpdate(taskStats[22], loads.slice(0, 23));
          expectWindowEqualsUpdate(taskStats[23], loads.slice(0, 24));
          expectWindowEqualsUpdate(taskStats[24], loads.slice(0, 25));
          expectWindowEqualsUpdate(taskStats[25], loads.slice(0, 26));
          expectWindowEqualsUpdate(taskStats[26], loads.slice(0, 27));
          expectWindowEqualsUpdate(taskStats[27], loads.slice(0, 28));
          expectWindowEqualsUpdate(taskStats[28], loads.slice(0, 29));
          expectWindowEqualsUpdate(taskStats[29], loads.slice(0, 30));
          // from the 31st value, begin to drop old values as our window is 30
          expectWindowEqualsUpdate(taskStats[30], loads.slice(1, 31));
          expectWindowEqualsUpdate(taskStats[31], loads.slice(2, 32));
          expectWindowEqualsUpdate(taskStats[32], loads.slice(3, 33));

          resolve();
        });

        for (const load of loads) {
          events$.next(mockTaskStatEvent('workerUtilization', load));
        }
      });
    });

    test('returns a running count of load with custom window size', async () => {
      const loads = [40, 80, 100, 100, 10, 10, 60, 40];
      const events$ = new Subject<TaskLifecycleEvent>();
      const taskPollingLifecycle = taskPollingLifecycleMock.create({
        events$: events$ as Observable<TaskLifecycleEvent>,
      });

      const BackgroundTaskUtilizationAggregator = createBackgroundTaskUtilizationAggregator(
        taskPollingLifecycle,
        new AdHocTaskCounter(),
        pollInterval,
        3
      );

      function expectWindowEqualsUpdate(
        taskStat: AggregatedStat<BackgroundTaskUtilizationStat>,
        window: number[]
      ) {
        expect(taskStat.value.load).toEqual(mean(window));
      }

      return new Promise<void>((resolve) => {
        BackgroundTaskUtilizationAggregator.pipe(
          // skip initial stat which is just initialized data which
          // ensures we don't stall on combineLatest
          skip(1),
          map(({ key, value }: AggregatedStat<BackgroundTaskUtilizationStat>) => ({
            key,
            value,
          })),
          take(loads.length),
          bufferCount(loads.length)
        ).subscribe((taskStats: Array<AggregatedStat<BackgroundTaskUtilizationStat>>) => {
          expectWindowEqualsUpdate(taskStats[0], loads.slice(0, 1));
          expectWindowEqualsUpdate(taskStats[1], loads.slice(0, 2));
          expectWindowEqualsUpdate(taskStats[2], loads.slice(0, 3));
          // from the 4th value, begin to drop old values as our window is 3
          expectWindowEqualsUpdate(taskStats[3], loads.slice(1, 4));
          expectWindowEqualsUpdate(taskStats[4], loads.slice(2, 5));
          expectWindowEqualsUpdate(taskStats[5], loads.slice(3, 6));
          expectWindowEqualsUpdate(taskStats[6], loads.slice(4, 7));
          expectWindowEqualsUpdate(taskStats[7], loads.slice(5, 8));
          resolve();
        });

        for (const load of loads) {
          events$.next(mockTaskStatEvent('workerUtilization', load));
        }
      });
    });
  });

  describe('summarizeUtilizationStats', () => {
    const lastUpdate = '2023-04-02T17:34:41.371Z';
    const monitoredStats = {
      timestamp: '2023-04-01T17:34:41.371Z',
      value: {
        adhoc: {
          created: {
            counter: 1,
          },
          ran: {
            service_time: {
              actual: 10,
              adjusted: 7,
              task_counter: 3,
            },
          },
        },
        recurring: {
          ran: {
            service_time: {
              actual: 79,
              adjusted: 66,
              task_counter: 10,
            },
          },
        },
        load: 63,
      },
    };

    test('should return null if monitoredStats is null', () => {
      expect(
        summarizeUtilizationStats({
          lastUpdate,
          // @ts-expect-error
          monitoredStats: null,
          isInternal: false,
        })
      ).toEqual({
        last_update: lastUpdate,
        stats: null,
      });
    });

    test('should return null if monitoredStats value is not defined', () => {
      expect(
        summarizeUtilizationStats({
          lastUpdate,
          // @ts-expect-error
          monitoredStats: {},
          isInternal: false,
        })
      ).toEqual({
        last_update: lastUpdate,
        stats: null,
      });
    });

    test('should return summary with all stats when isInternal is true', () => {
      expect(
        summarizeUtilizationStats({
          lastUpdate,
          monitoredStats,
          isInternal: true,
        })
      ).toEqual({
        last_update: lastUpdate,
        stats: {
          timestamp: monitoredStats.timestamp,
          value: monitoredStats.value,
        },
      });
    });

    test('should return summary with only public stats when isInternal is false', () => {
      expect(
        summarizeUtilizationStats({
          lastUpdate,
          monitoredStats,
          isInternal: false,
        })
      ).toEqual({
        last_update: lastUpdate,
        stats: {
          timestamp: monitoredStats.timestamp,
          value: {
            load: 63,
          },
        },
      });
    });
  });
});

function runAtMillisecondsAgo(now: number, ms: number): Date {
  return new Date(now - ms);
}

function roundUpToNearestSec(duration: number[], s: number): number[] {
  const pollInterval = s * 1000;
  return duration.map((d) => Math.ceil(d / pollInterval) * pollInterval);
}

const mockTaskStatEvent = (type: TaskManagerStats, value: number) => {
  return asTaskManagerStatEvent(type, asOk(value));
};

const mockTaskRunEvent = (
  overrides: Partial<ConcreteTaskInstance> = {},
  timing: TaskTiming,
  result: TaskRunResult = TaskRunResult.Success,
  persistence?: TaskPersistence
) => {
  const task = mockTaskInstance(overrides);
  return asTaskRunEvent(
    task.id,
    asOk({
      task,
      persistence:
        persistence ?? (task.schedule ? TaskPersistence.Recurring : TaskPersistence.NonRecurring),
      result,
      isExpired: false,
    }),
    timing
  );
};

const mockTaskInstance = (overrides: Partial<ConcreteTaskInstance> = {}): ConcreteTaskInstance => ({
  id: uuidv4(),
  attempts: 0,
  status: TaskStatus.Running,
  version: '123',
  runAt: new Date(),
  scheduledAt: new Date(),
  startedAt: new Date(),
  retryAt: new Date(Date.now() + 5 * 60 * 1000),
  state: {},
  taskType: 'alerting:test',
  params: {
    alertId: '1',
  },
  ownerId: null,
  ...overrides,
});
