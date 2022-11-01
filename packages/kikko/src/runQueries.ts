import { ISqlAdapter } from "@kikko-land/boono-sql";

import {
  IDb,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
  ITransactionOpts,
} from "./types";
import { assureDbIsRunning, unwrapQueries } from "./utils";

const colors = ["yellow", "cyan", "magenta"];

const runQueriesMiddleware: IQueriesMiddleware = async ({
  db,
  queries,
  transactionOpts,
}) => {
  const {
    localState: { transactionState: transactionsLocalState },
    sharedState: { dbBackend },
    sharedState,
  } = db.__state;

  if (!transactionsLocalState.current) {
    assureDbIsRunning(db, () => JSON.stringify(queries));
  }

  if (
    transactionOpts &&
    transactionsLocalState.current?.id !== transactionOpts.transactionId
  ) {
    throw new Error(
      `Cannot run queries in a transaction that is not the current one. Transaction opts: ${JSON.stringify(
        transactionOpts
      )}, local transaction: ${JSON.stringify(transactionsLocalState)}`
    );
  }

  const unwrappedQueries = unwrapQueries(queries.map((q) => q.toSql()));

  const startedAt = performance.now();
  const { result, performance: qPerformance } = await dbBackend.execQueries(
    unwrappedQueries,
    transactionOpts
      ? transactionOpts
      : transactionsLocalState.current
      ? {
          transactionId: transactionsLocalState.current.id,
          containsTransactionStart: false,
          containsTransactionFinish: false,
          containsTransactionRollback: false,
          rollbackOnFail: false,
        }
      : undefined
  );
  const endedAt = performance.now();

  if (!db.__state.localState.suppressLog) {
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
      `%c[${db.__state.sharedState.dbName}] ` +
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
        qPerformance?.blockTime !== undefined
          ? `blockTime=${(qPerformance.blockTime / 1000).toFixed(4)}`
          : "",
        `totalTime=${((endedAt - startedAt) / 1000).toFixed(4)}`,
      ]
        .filter((t) => t.length !== 0)
        .join(" ");

    const i =
      sharedState.transactionsStates.byId[
        transactionsLocalState.current?.id ?? ""
      ]?.i;
    const color = typeof i === "number" ? colors[i % colors.length] : "white";

    console.log(totalTiming, `color: ${color}`);
  }

  const perfData =
    sharedState.transactionsStates.byId[
      transactionsLocalState.current?.id ?? ""
    ]?.performance;

  if (perfData) {
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

    if (qPerformance.blockTime) {
      if (!perfData.blockTime) {
        perfData.blockTime = 0;
      }

      perfData.blockTime += qPerformance.blockTime;
    }
  }

  return { db: db, result, performance: qPerformance, queries };
};

export const runQueries = async (
  db: IDb,
  queries: ISqlAdapter[],
  transactionOpts?: ITransactionOpts
) => {
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
    transactionOpts: transactionOpts,
  });
};
