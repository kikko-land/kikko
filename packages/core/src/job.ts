import { ISql } from "@kikko-land/sql";
import { BehaviorSubject, filter, firstValueFrom } from "rxjs";
import { DeepReadonly } from "ts-essentials";

import { ITransaction } from "./types";
import { makeId } from "./utils";

export type DistributiveOmit<
  T,
  K extends keyof Record<string, unknown>
> = T extends unknown ? Omit<T, K> : never;

export type IJob =
  | { type: "runTransaction"; id: string; transaction: ITransaction }
  | { type: "runQueries"; queries: ISql[]; id: string }
  | { type: "initDb"; name: string; id: string };

export type IJobsState = DeepReadonly<{
  queue: IJob[];
  current?: IJob;
}>;

// Actually it works like locking mechanism
export const acquireJob = async (
  jobsState$: BehaviorSubject<IJobsState>,
  _job: DistributiveOmit<IJob, "id">
): Promise<IJob> => {
  const id = makeId();
  const job = { ..._job, id };

  const { current, queue } = jobsState$.value;

  if (current || queue.length > 0) {
    const promise = firstValueFrom(
      jobsState$.pipe(filter(({ current }) => current?.id === id))
    );

    jobsState$.next({ queue: [...queue, job], current });

    await promise;
  } else {
    jobsState$.next({ queue: [], current: job });
  }

  return job;
};

export const releaseJob = (
  jobsState$: BehaviorSubject<IJobsState>,
  job: IJob
) => {
  const { current, queue } = jobsState$.value;

  if (current?.id !== job.id) {
    throw new Error(
      `Can't release job that is not currently running, current: ${JSON.stringify(
        current
      )}, queue: ${JSON.stringify(queue)}, toRelease: ${JSON.stringify(job)}`
    );
  }

  jobsState$.next({ queue: queue.slice(1), current: queue[0] });
};

export const whenAllJobsDone = async (
  jobsState$: BehaviorSubject<IJobsState>
) => {
  return firstValueFrom(
    jobsState$.pipe(filter(({ queue }) => queue.length === 0))
  );
};
