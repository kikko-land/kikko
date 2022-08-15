import { ISqlAdapter } from "@kikko-land/sql";

import { acquireJob, IJob, releaseJob } from "./job";
import {
  IDbState,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
} from "./types";
import { assureDbIsRunning, unwrapQueries } from "./utils";

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
      queries: queries.map((q) => q.toSql()),
    });
  }

  const execOpts = {
    log: {
      suppress: Boolean(suppressLog),
      transactionId: transactionsLocalState.current?.id,
    },
  };

  try {
    const result = await dbBackend.execQueries(
      unwrapQueries(queries.map((q) => q.toSql())),
      execOpts
    );

    return { dbState, result, queries };
  } finally {
    if (job) {
      releaseJob(jobsState$, job);
    }
  }
};

export const runQueries = async <D extends Record<string, unknown>>(
  state: IDbState,
  queries: ISqlAdapter[]
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
  query: ISqlAdapter
) => {
  return (await runQueries<D>(state, [query]))[0] || [];
};
