import { Sql } from "@trong-orm/sql";
import { QueryExecResult } from "@trong-orm/sql.js";

import { buildRunQueriesCommand } from "../commands";
import { acquireJob, IJob, releaseJob } from "./job";
import { runWorkerCommand } from "./runWorkerCommand";
import {
  IDbState,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
} from "./types";

const mapRows = <T extends Record<string, unknown>>(
  result: QueryExecResult
) => {
  return (result?.values?.map((res) => {
    let obj: Record<string, any> = {};

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
    localState: { transactionsState: transactionsLocalState },
    sharedState: { transactionsState: transactionsSharedState, jobsState },
  } = dbState;

  if (
    transactionsLocalState.currentlyRunning &&
    transactionsSharedState.currentlyRunning
  ) {
    if (
      transactionsLocalState.currentlyRunning.id !==
      transactionsSharedState.currentlyRunning.id
    ) {
      // Is it possible?
      throw new Error(
        "Internal error: local running transaction is not the same as shared state transaction"
      );
    }
  }

  let job: IJob | undefined;

  if (!transactionsLocalState.currentlyRunning) {
    job = await acquireJob(jobsState, {
      type: "runQueries",
      queries,
    });
  }

  try {
    const result = (
      await runWorkerCommand(dbState, buildRunQueriesCommand(dbState, queries))
    ).map((queriesResults, i) => {
      if (queriesResults.length > 1) {
        console.warn(
          `Omitting query result of ${queries[i].sql}: ${queriesResults.slice(
            1
          )}`
        );
      }

      return queriesResults[0] ? mapRows(queriesResults[0]) : [];
    });

    return { dbState, result, queries };
  } finally {
    if (job) {
      releaseJob(jobsState, job);
    }
  }
};

export const runQueries = async <D extends Record<string, unknown>>(
  state: IDbState,
  queries: Sql[]
): Promise<D[][]> => {
  const middlewares: IQueriesMiddleware[] = [
    ...state.localState.queriesMiddlewares,
    runQueriesMiddleware,
  ].reverse();

  let toCall: INextQueriesMiddleware = async (args) => args;

  for (const middleware of middlewares) {
    const currentCall = toCall;

    toCall = (args: IQueriesMiddlewareState) =>
      middleware({ ...args, next: currentCall });
  }

  return (await toCall({ dbState: state, result: [], queries: queries }))
    .result as D[][];
};

export const runQuery = async <D extends Record<string, unknown>>(
  state: IDbState,
  query: Sql
) => {
  return (await runQueries<D>(state, [query]))[0] || [];
};
