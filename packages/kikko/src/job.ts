import { ISql } from "@kikko-land/sql";
import { DeepReadonly } from "ts-essentials";

import { ReactiveVar } from "./reactiveVar";
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
  jobsState: ReactiveVar<IJobsState>,
  _job: DistributiveOmit<IJob, "id">
): Promise<IJob> => {
  const id = makeId();
  const job = { ..._job, id };

  const { current, queue } = jobsState.value;

  if (current || queue.length > 0) {
    const promise = jobsState.waitTill((newVal) => newVal.current?.id === id);

    jobsState.value = {
      queue: [...queue, job],
      current,
    };

    await promise;
  } else {
    jobsState.value = {
      queue: [],
      current: job,
    };
  }

  return job;
};

export const releaseJob = (jobsState: ReactiveVar<IJobsState>, job: IJob) => {
  const { current, queue } = jobsState.value;

  if (current?.id !== job.id) {
    throw new Error(
      `Can't release job that is not currently running, current: ${JSON.stringify(
        current,
        null,
        2
      )}, queue: ${JSON.stringify(queue, null, 2)}, toRelease: ${JSON.stringify(
        job,
        null,
        2
      )}`
    );
  }

  jobsState.value = { queue: queue.slice(1), current: queue[0] };
};

export const whenAllJobsDone = async (jobsState: ReactiveVar<IJobsState>) => {
  return jobsState.waitTill(({ queue }) => queue.length === 0);
};
