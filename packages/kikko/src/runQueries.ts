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

const runQueriesMiddleware: IQueriesMiddleware = async ({ db, queries }) => {
  const {
    localState: { transactionsState: transactionsLocalState },
    sharedState: {
      transactionsState: transactionsSharedState,
      jobsState,
      dbBackend,
    },
    sharedState,
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

    if (!db.__state.localState.suppressLog) {
      if (
        transactionsLocalState.current &&
        transactionsLocalState.current.id !==
          sharedState.transactionLoggingState.id
      ) {
        sharedState.transactionLoggingState.id =
          transactionsLocalState.current.id;
        sharedState.transactionLoggingState.i++;
      }

      if (!transactionsLocalState?.current?.id) {
        sharedState.transactionLoggingState.id = undefined;
      }

      const queriesTimings = result
        .map(({ performance }, i) => {
          const times = [
            performance.prepareTime !== undefined
              ? `prepareTime=${(performance.prepareTime / 1000).toFixed(4)}`
              : "",
            performance.execTime !== undefined
              ? `execTime=${(performance.execTime / 1000).toFixed(4)}`
              : "",
            performance.freeTime !== undefined
              ? `freeTime=${(performance.freeTime / 1000).toFixed(4)}`
              : "",
          ]
            .filter((t) => t.length !== 0)
            .join(" ");

          return (
            "{" +
            [unwrappedQueries[i].text.slice(0, 1000), times]
              .filter((v) => v.length !== 0)
              .join(" ") +
            "}"
          );
        })
        .join("\n");

      const totalTiming =
        `%c[${db.__state.sharedState.dbName}]` +
        [
          transactionsLocalState.current?.id
            ? `[tr_id=${transactionsLocalState.current?.id.substring(0, 6)}]`
            : "",
          queriesTimings,
          qPerformance?.sendTime !== undefined
            ? `sendTime=${(qPerformance.sendTime / 1000).toFixed(4)}`
            : "",
          qPerformance?.receiveTime !== undefined
            ? `receiveTime=${(qPerformance.receiveTime / 1000).toFixed(4)}`
            : "",
          `totalTime=${((endedAt - startedAt) / 1000).toFixed(4)}`,
        ]
          .filter((t) => t.length === 0)
          .join(" ");

      console.log(
        totalTiming,
        `color: ${
          sharedState.transactionLoggingState.id
            ? colors[sharedState.transactionLoggingState.i % colors.length]
            : "white"
        }`
      );
    }

    if (transactionsLocalState.current && transactionsSharedState?.current) {
      if (
        transactionsLocalState.current.id === transactionsSharedState.current.id
      ) {
        const perfData = transactionsSharedState.performance;

        if (result.some((d) => d.performance.execTime !== undefined)) {
          if (perfData.execTime === undefined) {
            perfData.execTime = 0;
          }

          perfData.execTime += result.reduce(
            (partialSum, a) => partialSum + (a.performance.execTime ?? 0),
            0
          );
        }

        if (result.some((d) => d.performance.freeTime !== undefined)) {
          if (perfData.freeTime === undefined) {
            perfData.freeTime = 0;
          }

          perfData.freeTime += result.reduce(
            (partialSum, a) => partialSum + (a.performance.freeTime ?? 0),
            0
          );
        }

        if (result.some((d) => d.performance.prepareTime !== undefined)) {
          if (perfData.prepareTime === undefined) {
            perfData.prepareTime = 0;
          }

          perfData.prepareTime += result.reduce(
            (partialSum, a) => partialSum + (a.performance.prepareTime ?? 0),
            0
          );
        }

        if (qPerformance.sendTime) {
          if (!perfData.sendTime) {
            perfData.sendTime = 0;
          }

          perfData.sendTime += qPerformance.sendTime;
        }

        if (qPerformance.receiveTime) {
          if (!perfData.receiveTime) {
            perfData.receiveTime = 0;
          }

          perfData.receiveTime += qPerformance.receiveTime;
        }
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
      sendTime: undefined,
      receiveTime: undefined,
      totalTime: 0,
    },
    queries: queries.map((q) => q.toSql()),
  });
};
