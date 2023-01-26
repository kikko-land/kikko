import {
  buildAsyncQueryRunner,
  buildSyncQueryRunner,
  initJobsState,
  IPrimitiveValue,
  IQuery,
  ITransactionOpts,
  whenAllJobsDone,
} from "@kikko-land/kikko";
import * as Comlink from "comlink";

import { DbBackend } from "./DbBackend";

let db: DbBackend | undefined;

const jobsState = initJobsState();

let isStopped = false;

const initialize = async (
  dbName: string,
  wasmUrl: string,
  pageSize: number,
  cacheSize: number
) => {
  if (db) {
    // TODO: send error response
    throw new Error("DB already initialized!");
  }

  db = new DbBackend(dbName, wasmUrl, pageSize, cacheSize);

  await db.init();
};

const queriesRunner = buildSyncQueryRunner(jobsState, {
  execPrepared: (query: IQuery, preparedValues: IPrimitiveValue[][]) => {
    if (!db) {
      throw new Error("DB not initialized!");
    }

    return db.execPrepared(query.text, preparedValues);
  },
  execUsual: (q: IQuery) => {
    if (!db) {
      throw new Error("DB not initialized!");
    }

    return db.sqlExec(q.text, q.values);
  },
  rollback: () => {
    if (!db) {
      throw new Error("DB not initialized!");
    }

    db.sqlExec("ROLLBACK");
  },
});

const runQueries = async (
  queries:
    | { type: "usual"; values: IQuery[] }
    | { type: "prepared"; query: IQuery; preparedValues: IPrimitiveValue[][] },
  sentAt: number,
  transactionOpts?: ITransactionOpts
) => {
  if (isStopped) {
    throw new Error("DB is stopped!");
  }

  if (!db) {
    throw new Error("DB not initialized!");
  }

  const sendTime = new Date().getTime() - sentAt;

  const res = await queriesRunner.run(queries, transactionOpts);

  return {
    ...res,
    performance: {
      ...res.performance,
      sendTime,
    },
    sentAt: new Date().getTime(),
  };
};

const stop = async () => {
  isStopped = true;

  await whenAllJobsDone(jobsState);
};

const DbWorker = { runQueries, initialize, stop };

Comlink.expose(DbWorker);

export type DbWorker = typeof DbWorker;
