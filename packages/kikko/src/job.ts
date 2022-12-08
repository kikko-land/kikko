import { DeepReadonly } from "ts-essentials";

import { ReactiveVar, reactiveVar, TimeoutError } from "./reactiveVar";
import { makeId } from "./utils";

export type DistributiveOmit<
  T,
  K extends keyof Record<string, unknown>
> = T extends unknown ? Omit<T, K> : never;

export type IJob = { id: string };

export type IJobsState = DeepReadonly<{
  queue: IJob[];
  current?: IJob;
}>;

const stateToDebugString = (state: IJobsState) => {
  const { current, queue } = state;

  return `current running job: ${JSON.stringify(
    current,
    null,
    2
  )}, queue: ${JSON.stringify(queue, null, 2)}`;
};

export const initJobsState = (): ReactiveVar<IJobsState> =>
  reactiveVar(
    {
      queue: [],
      current: undefined,
    } as IJobsState,
    { label: "jobsState" }
  );

// Actually it works like locking mechanism
export const acquireJob = async (
  jobsState: ReactiveVar<IJobsState>,
  optionalId?: string
): Promise<IJob> => {
  const id = optionalId ?? makeId();
  const job = { id };

  const { current, queue } = jobsState.value;

  if (current || queue.length > 0) {
    const promise = jobsState.waitTill((newVal) => newVal.current?.id === id, {
      timeout: 120_000,
    });

    jobsState.value = {
      queue: [...queue, job],
      current,
    };

    try {
      await promise;
    } catch (e) {
      jobsState.value = {
        ...jobsState.value,
        queue: jobsState.value.queue.filter((j) => j.id !== id),
      };

      if (e instanceof TimeoutError) {
        throw new TimeoutError(
          `Timeout error while job acquire: '${
            e.message
          }'. Is it a dead lock? ${stateToDebugString(
            jobsState.value
          )}, jobToAcquire: ${JSON.stringify(job, null, 2)}`
        );
      }

      throw e;
    }
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
      `Can't release job that is not currently running, ${stateToDebugString(
        jobsState.value
      )}, toRelease: ${JSON.stringify(job, null, 2)}`
    );
  }

  jobsState.value = { queue: queue.slice(1), current: queue[0] };
};

export const whenAllJobsDone = async (jobsState: ReactiveVar<IJobsState>) => {
  try {
    return jobsState.waitTill(
      ({ queue, current }) => queue.length === 0 && current === undefined,
      { timeout: 120_000 }
    );
  } catch (e) {
    if (e instanceof TimeoutError) {
      throw new TimeoutError(
        `Timeout error while awaiting all jobs done: '${e.message}'. Is it a dead lock?`
      );
    }

    throw e;
  }
};
