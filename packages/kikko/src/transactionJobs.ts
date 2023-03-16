import { DeepReadonly } from "ts-essentials";

import { ReactiveVar, reactiveVar, TimeoutError } from "./reactiveVar";
import { ITransactionOpts } from "./types";

export type DistributiveOmit<
  T,
  K extends keyof Record<string, unknown>
> = T extends unknown ? Omit<T, K> : never;

export type ITransactionJob = { id: string };

export type ITransactionsJobsState = DeepReadonly<{
  queue: ITransactionJob[];
  current?: ITransactionJob;
}>;

const stateToDebugString = (state: ITransactionsJobsState) => {
  const { current, queue } = state;

  return `Current running transaction job: ${JSON.stringify(
    current,
    null,
    2
  )}, queue of transaction jobs: ${JSON.stringify(queue, null, 2)}`;
};

export const initJobsState = (): ReactiveVar<ITransactionsJobsState> =>
  reactiveVar(
    {
      queue: [],
      current: undefined,
    } as ITransactionsJobsState,
    { label: "jobsState", deduplicate: false }
  );

const buildJob = (id: string): ITransactionJob => {
  return { id };
};

// Actually it works like locking mechanism
export const acquireJob = async (
  jobsState: ReactiveVar<ITransactionsJobsState>,
  job: ITransactionJob
): Promise<void> => {
  const { current, queue } = jobsState.value;

  if (current || queue.length > 0) {
    const promise = jobsState.waitTill(
      (newVal) => newVal.current?.id === job.id,
      {
        timeout: 120_000,
      }
    );

    jobsState.value = {
      queue: [...queue, job],
      current,
    };

    try {
      await promise;
    } catch (e) {
      jobsState.value = {
        ...jobsState.value,
        queue: jobsState.value.queue.filter((j) => j.id !== job.id),
      };

      if (e instanceof TimeoutError) {
        throw new TimeoutError(
          `Timeout error while transaction job acquire: '${
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
};

export const releaseJob = (
  jobsState: ReactiveVar<ITransactionsJobsState>,
  job: ITransactionJob
) => {
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

export const whenAllJobsDone = async (
  jobsState: ReactiveVar<ITransactionsJobsState>
) => {
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

export const acquireWithTrJobOrWait = async (
  jobsState: ReactiveVar<ITransactionsJobsState>,
  transactionOpts?: ITransactionOpts
) => {
  let job: ITransactionJob | undefined;

  if (transactionOpts) {
    const newJob = buildJob(transactionOpts.transactionId);

    if (transactionOpts.containsTransactionStart) {
      await acquireJob(jobsState, newJob);
    } else {
      await jobsState.waitTill((state) => state.current?.id === newJob.id);
    }

    job = newJob;
  } else {
    await jobsState.waitTill((state) => state.current?.id === undefined);
  }

  return job;
};

export const releaseTrJobIfPossible = (
  jobsState: ReactiveVar<ITransactionsJobsState>,
  job: ITransactionJob | undefined,
  transactionOpts?: ITransactionOpts
) => {
  if (
    job &&
    (!transactionOpts ||
      transactionOpts?.containsTransactionFinish ||
      transactionOpts?.containsTransactionRollback)
  ) {
    releaseJob(jobsState, job);
  }

  if (!job && transactionOpts) {
    throw new Error("Transaction job was not started, nothing to release!");
  }
};
