import {
  acquireWithTrJobOrWait,
  initJobsState,
  IQuery,
  ITransactionOpts,
  releaseTrJobIfPossible,
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

const execQueries = async (
  queries: IQuery[],
  sentAt: number,
  transactionOpts: ITransactionOpts
) => {
  if (isStopped) {
    throw new Error("DB is stopped!");
  }

  if (!db) {
    throw new Error("DB not initialized!");
  }

  const sendTime = new Date().getTime() - sentAt;

  const currentDb = db;

  const startBlockAt = performance.now();
  const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
  const endBlockAt = performance.now();
  const blockTime = endBlockAt - startBlockAt;

  try {
    const queriesResult = queries.map((q) => {
      try {
        return currentDb.sqlExec(q.text, q.values);
      } catch (e) {
        if (e instanceof Error) {
          e.message = `Error while executing query: ${q.text} - ${e.message}`;
        }
        throw e;
      }
    });

    return {
      result: queriesResult,
      performance: {
        sendTime,
        blockTime,
      },
      sentAt: new Date().getTime(),
    };
  } catch (e) {
    if (transactionOpts.rollbackOnFail) {
      try {
        currentDb.sqlExec("ROLLBACK");
      } catch (rollbackError) {
        console.error(`Failed to rollback`, e, rollbackError);
      }
    }

    throw e;
  } finally {
    releaseTrJobIfPossible(jobsState, job, transactionOpts);
  }
};

const stop = async () => {
  isStopped = true;

  await whenAllJobsDone(jobsState);
};

const DbWorker = { execQueries, initialize, stop };

Comlink.expose(DbWorker);

export type DbWorker = typeof DbWorker;
