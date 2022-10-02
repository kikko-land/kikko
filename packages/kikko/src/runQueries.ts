import { ISqlAdapter } from "@kikko-land/sql";

import { acquireJob, IJob, releaseJob } from "./job";
import {
  IDb,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
} from "./types";
import { assureDbIsRunning, unwrapQueries } from "./utils";

const colors = ["yellow", "cyan", "magenta"];
let currentTransactionI = 0;
let currentTransactionId: string | undefined;

const runQueriesMiddleware: IQueriesMiddleware = async ({ db, queries }) => {
  const {
    localState: { transactionsState: transactionsLocalState },
    sharedState: {
      transactionsState: transactionsSharedState,
      jobsState,
      dbBackend,
    },
  } = db.__state;

  if (!transactionsLocalState.current) {
    assureDbIsRunning(db, () => JSON.stringify(queries));
  }

  if (transactionsLocalState.current && transactionsSharedState?.current) {
    if (
      transactionsLocalState.current.id !== transactionsSharedState.current.id
    ) {
      // Is it possible?
      throw new Error(
        "Internal error: local running transaction is not the same as shared state transaction"
      );
    }
  }

  let job: IJob | undefined;

  const unwrappedQueries = unwrapQueries(queries.map((q) => q.toSql()));

  if (!transactionsLocalState.current) {
    job = await acquireJob(jobsState, {
      type: "runQueries",
      queries: queries.map((q) => q.toSql()),
    });
  }

  try {
    const startedAt = performance.now();
    const { result, performance: qPerformance } = await dbBackend.execQueries(
      unwrappedQueries
    );
    const endedAt = performance.now();

    if (
      transactionsLocalState.current &&
      transactionsLocalState.current.id !== currentTransactionId
    ) {
      currentTransactionId = transactionsLocalState.current.id;
      currentTransactionI++;
    }

    if (!transactionsLocalState?.current?.id) {
      currentTransactionId = undefined;
    }

    const queriesTimings = result
      .map(({ performance }, i) => {
        const times = [
          `prepareTime=${(performance.prepareTime / 1000).toFixed(4)}`,
          `execTime=${(performance.execTime / 1000).toFixed(4)}`,
          `freeTime=${(performance.freeTime / 1000).toFixed(4)}`,
        ].join(" ");

        return `{${unwrappedQueries[i].text.slice(0, 1000)} ${times}}`;
      })
      .join(", ");

    console.log(
      `%c[${db.__state.sharedState.dbName}]${
        transactionsLocalState.current?.id
          ? `[tr_id=${transactionsLocalState.current?.id.substring(0, 6)}]`
          : ""
      } ${queriesTimings} sendTime=${(qPerformance.sendTime / 1000).toFixed(
        4
      )} receiveTime=${(qPerformance.receiveTime / 1000).toFixed(
        4
      )} totalTime=${((endedAt - startedAt) / 1000).toFixed(4)}`,
      `color: ${
        currentTransactionId
          ? colors[currentTransactionI % colors.length]
          : "white"
      }`
    );

    if (transactionsLocalState.current && transactionsSharedState?.current) {
      if (
        transactionsLocalState.current.id === transactionsSharedState.current.id
      ) {
        const perfData = transactionsSharedState.performance;

        perfData.execTime += result.reduce(
          (partialSum, a) => partialSum + a.performance.execTime,
          0
        );
        perfData.freeTime += result.reduce(
          (partialSum, a) => partialSum + a.performance.freeTime,
          0
        );
        perfData.prepareTime += result.reduce(
          (partialSum, a) => partialSum + a.performance.prepareTime,
          0
        );
        perfData.sendTime += qPerformance.sendTime;
        perfData.receiveTime += qPerformance.receiveTime;
      }
    }

    return { db: db, result, performance: qPerformance, queries };
  } finally {
    if (job) {
      releaseJob(jobsState, job);
    }
  }
};

export const runQueries = async (db: IDb, queries: ISqlAdapter[]) => {
  const middlewares: IQueriesMiddleware[] = [
    ...db.__state.localState.queriesMiddlewares,
    runQueriesMiddleware,
  ].reverse();

  let toCall: INextQueriesMiddleware = (args) => Promise.resolve(args);

  for (const middleware of middlewares) {
    const currentCall = toCall;

    toCall = (args: IQueriesMiddlewareState) =>
      middleware({ ...args, next: currentCall });
  }

  return await toCall({
    db: db,
    result: [],
    performance: {
      sendTime: 0,
      receiveTime: 0,
      totalTime: 0,
    },
    queries: queries.map((q) => q.toSql()),
  });
};
