import { Sql } from "@trong-orm/sql";
import { nanoid } from "nanoid";
import { filter, first, firstValueFrom, Subject } from "rxjs";

import { ITransaction } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export type IJob =
  | { type: "runTransaction"; id: string; transaction: ITransaction }
  | { type: "runQueries"; queries: Sql[]; id: string }
  | { type: "initDb"; name: string; id: string };

// TODO: maybe make just behavior subject with state like IJobState?
export interface IJobState {
  // First element is always running job
  queue: IJob[];
  next$: Subject<IJob>;
}

// Actually it is locking mechanism
export const acquireJob = async (
  { queue, next$ }: IJobState,
  _job: DistributiveOmit<IJob, "id">
): Promise<IJob> => {
  const id = nanoid();
  const job = { ..._job, id };

  if (queue.length !== 0) {
    const promise = firstValueFrom(
      next$.pipe(
        filter((job) => job.id === id),
        first()
      )
    );

    queue.push(job);

    await promise;
  } else {
    queue.push(job);
  }

  return job;
};

export const releaseJob = ({ queue, next$ }: IJobState, job: IJob) => {
  if (queue[0] !== job) {
    throw new Error(
      `Internal error: first element of jobs queue is not a running job, job: ${JSON.stringify(
        job
      )}, queue: ${JSON.stringify(queue)}`
    );
  }

  queue.shift();

  if (queue[0]) {
    next$.next(queue[0]);
  }
};

export const whenAllJobsDone = async ({ queue, next$ }: IJobState) => {
  return firstValueFrom(next$.pipe(filter(() => queue.length === 0)));
};
