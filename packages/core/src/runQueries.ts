import { acquireJob, IJob, releaseJob } from "./job";
import {
  IDbState,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
  IQueryResult,
  IWithToSql,
} from "./types";
import { assureDbIsRunning, unwrapQueries } from "./utils";

const mapRows = <T extends Record<string, unknown>>(result: IQueryResult) => {
  return (result?.values?.map((res) => {
    const obj: Record<string, unknown> = {};

    result.columns.forEach((col, i) => {
      obj[col] = res[i];
    });

    return obj;
  }) || []) as T[];
};

const runQueriesMiddleware: IQueriesMiddleware = async ({
  dbState,
  queries,
}) => {
  const {
    localState: { transactionsState: transactionsLocalState, suppressLog },
    sharedState: {
      transactionsState: transactionsSharedState,
      jobsState$,
      dbBackend,
    },
  } = dbState;

  if (!transactionsLocalState.current) {
    assureDbIsRunning(dbState, () => JSON.stringify(queries));
  }

  if (transactionsLocalState.current && transactionsSharedState.current) {
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

  if (!transactionsLocalState.current) {
    job = await acquireJob(jobsState$, {
      type: "runQueries",
      queries: queries,
    });
  }

  const execOpts = {
    log: {
      suppress: Boolean(suppressLog),
      transactionId: transactionsLocalState.current?.id,
    },
  };

  try {
    const result = (
      await dbBackend.execQueries(unwrapQueries(queries), execOpts)
    ).map((queriesResults, i) => {
      if (queriesResults.length > 1) {
        console.warn(
          `Omitting query result of ${queries[i].sql}: ${JSON.stringify(
            queriesResults.slice(1)
          )}`
        );
      }

      return queriesResults[0] ? mapRows(queriesResults[0]) : [];
    });

    return { dbState, result, queries };
  } finally {
    if (job) {
      releaseJob(jobsState$, job);
    }
  }
};

export const runQueries = async <D extends Record<string, unknown>>(
  state: IDbState,
  queries: IWithToSql[]
): Promise<D[][]> => {
  const middlewares: IQueriesMiddleware[] = [
    ...state.localState.queriesMiddlewares,
    runQueriesMiddleware,
  ].reverse();

  let toCall: INextQueriesMiddleware = (args) => Promise.resolve(args);

  for (const middleware of middlewares) {
    const currentCall = toCall;

    toCall = (args: IQueriesMiddlewareState) =>
      middleware({ ...args, next: currentCall });
  }

  return (
    await toCall({
      dbState: state,
      result: [],
      queries: queries.map((q) => q.toSql()),
    })
  ).result as D[][];
};

export const runQuery = async <D extends Record<string, unknown>>(
  state: IDbState,
  query: IWithToSql
) => {
  return (await runQueries<D>(state, [query]))[0] || [];
};
