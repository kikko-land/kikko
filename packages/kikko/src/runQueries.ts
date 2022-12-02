import { getTime } from "./measurePerformance";
import {
  IDb,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
  IQueriesToRun,
  ITransactionOpts,
} from "./types";
import { assureDbIsRunning } from "./utils";

const compact = <T>(arr: (T | null | undefined)[]) =>
  arr.filter((element): element is T => {
    return element !== null;
  });
const sum = (arr: number[]) => arr.reduce((partialSum, a) => partialSum + a, 0);
const compactAndSum = (arr: (number | null | undefined)[]) => sum(compact(arr));

const runQueriesMiddleware: IQueriesMiddleware = async ({
  db,
  queries,
  transactionOpts,
}) => {
  const {
    localState: { transactionState: transactionsLocalState },
    sharedState: { dbBackend, logFns },
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

  const startedAt = getTime();
  const {
    result,
    performance: qPerformance,
    textQueries,
  } = await (async () => {
    const opts = transactionOpts
      ? transactionOpts
      : transactionsLocalState.current
      ? {
          transactionId: transactionsLocalState.current.id,
          containsTransactionStart: false,
          containsTransactionFinish: false,
          containsTransactionRollback: false,
          rollbackOnFail: false,
          isAtomic: false,
        }
      : undefined;
    if (queries.type === "prepared") {
      const q = queries.query.toSql();

      if (q._values.length !== 0) {
        throw new Error(
          "You can't use prepared var through ${} for runPreparedQuery. Please, manually specify variables with '?'."
        );
      }
      const toExec = q.preparedQuery.text;

      return {
        ...(await dbBackend.execPreparedQuery(
          q.preparedQuery,
          queries.preparedValues,
          opts
        )),
        textQueries: [toExec],
      };
    } else {
      const toExec = queries.values.map((q) => q.preparedQuery);

      return {
        ...(await dbBackend.execQueries(toExec, opts)),
        textQueries: toExec.map((q) => q.text),
      };
    }
  })();
  const endedAt = getTime();

  if (!db.__state.localState.suppressLog) {
    const formatTime = (name: string, time: number) => {
      return `${name}=${(time / 1000).toFixed(4)}`;
    };

    const queriesTimings = (() => {
      if (queries.type === "prepared") {
        const firstResult = result[0];
        const times = [
          firstResult.performance.prepareTime !== undefined
            ? formatTime(
                "prepareTime",
                compactAndSum(result.map((r) => r.performance.prepareTime))
              )
            : "",
          firstResult.performance.execTime !== undefined
            ? formatTime(
                "execTime",
                compactAndSum(result.map((r) => r.performance.execTime))
              )
            : "",
        ]
          .filter((t) => t.length !== 0)
          .join(" ");

        return [
          [
            textQueries[0].slice(0, 1000),
            `for ${queries.preparedValues.length} values`,
            times,
          ]
            .filter((v) => v.length !== 0)
            .join(" "),
        ];
      } else {
        return result.map(({ performance }, i) => {
          const times = [
            performance.prepareTime !== undefined
              ? formatTime("prepareTime", performance.prepareTime)
              : "",
            performance.execTime !== undefined
              ? formatTime("execTime", performance.execTime)
              : "",
          ]
            .filter((t) => t.length !== 0)
            .join(" ");

          return [textQueries[i].slice(0, 1000), times]
            .filter((v) => v.length !== 0)
            .join(" ");
        });
      }
    })();

    const resultStr = (() => {
      if (queriesTimings.length === 1) {
        return queriesTimings[0];
      } else {
        return `\n` + queriesTimings.map((s) => `{${s}}`).join("\n");
      }
    })();

    const totalTiming =
      `%c[${db.__state.sharedState.dbName}] ` +
      [
        transactionsLocalState.current?.id
          ? `[tr_id=${transactionsLocalState.current?.id.substring(0, 6)}]`
          : "",
        resultStr,
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

    logFns.logQuery(totalTiming, i);
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
  queries: IQueriesToRun,
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
    queries,
    transactionOpts: transactionOpts,
  });
};
