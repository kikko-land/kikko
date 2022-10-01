import { ISqlAdapter } from "@kikko-land/sql";

import { createNanoEvents } from "./createNanoEvents";
import { acquireJob, IJobsState, releaseJob, whenAllJobsDone } from "./job";
import { reactiveVar } from "./reactiveVar";
import { runQueries, runQuery } from "./runQueries";
import { runInTransactionFunc } from "./transaction";
import {
  IAtomicTransaction,
  IDb,
  IDbBackend,
  IKikkoEvents,
  IQueriesMiddleware,
} from "./types";
import { makeId } from "./utils";

export type IDbClientPlugin = (state: IDb) => IDb;

export type IInitDbClientConfig = {
  dbName: string;
  dbBackend: Promise<IDbBackend> | IDbBackend;
  plugins?: IDbClientPlugin[];
  queriesMiddlewares?: IQueriesMiddleware[];
};

export const initDbClient = async ({
  dbName,
  plugins,
  queriesMiddlewares,
  dbBackend,
}: IInitDbClientConfig): Promise<IDb> => {
  const runningState = reactiveVar<"running" | "stopping" | "stopped">(
    "running",
    { label: "runningState" }
  );
  const dbBackendCalled = (await dbBackend)({
    dbName,
  });

  const jobsState = reactiveVar(
    {
      queue: [],
      current: undefined,
    } as IJobsState,
    { label: "jobsState" }
  );

  const db: IDb = {
    __state: {
      sharedState: {
        clientId: makeId(),
        dbBackend: dbBackendCalled,
        dbName,

        runningState: runningState,

        eventsEmitter: createNanoEvents<IKikkoEvents>(),

        jobsState: jobsState,
        transactionsState: {},
      },
      localState: {
        queriesMiddlewares: queriesMiddlewares || [],
        transactionsState: {},
      },
    },
    transaction<T>(
      func: (state: IDb) => Promise<T>,
      opts?: { label?: string; type?: "deferred" | "immediate" | "exclusive" }
    ): Promise<T> {
      return runInTransactionFunc<T>(this, opts?.type || "deferred", func, {
        label: opts?.label,
      });
    },
    atomicTransaction(
      func: (scope: IAtomicTransaction) => void,
      opts?: { label?: string; type?: "deferred" | "immediate" | "exclusive" }
    ): Promise<void> {
      return Promise.resolve();
    },
    runQueries<D extends Record<string, unknown>>(
      queries: ISqlAdapter[]
    ): Promise<D[][]> {
      return runQueries<D>(this, queries);
    },
    runQuery<D extends Record<string, unknown>>(
      query: ISqlAdapter
    ): Promise<D[]> {
      return runQuery<D>(this, query);
    },
  };

  const job = await acquireJob(db.__state.sharedState.jobsState, {
    type: "initDb",
    name: dbName,
  });

  let currentState = db;

  try {
    const getRunningState = () => db.__state.sharedState.runningState.value;

    if (getRunningState() !== "running") return db;

    await dbBackendCalled.initialize();

    if (getRunningState() !== "running") return db;

    for (const plugin of plugins || []) {
      currentState = plugin(currentState);
    }
  } finally {
    releaseJob(jobsState, job);
  }

  await db.__state.sharedState.eventsEmitter.emit("initialized", db);

  return currentState;
};

export const stopDb = async (state: IDb) => {
  state.__state.sharedState.runningState.value = "stopping";

  await whenAllJobsDone(state.__state.sharedState.jobsState);
  await state.__state.sharedState.dbBackend.stop();

  state.__state.sharedState.runningState.value = "stopped";

  queueMicrotask(() => {
    state.__state.sharedState.runningState.stop();
    state.__state.sharedState.jobsState.stop();
  });
};
