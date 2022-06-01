import { QueryExecResult } from "@harika-org/sql.js";
import { Sql } from "@trong/sql";

import { buildRunQueriesCommand } from "../commands";
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
  const result = (
    await runWorkerCommand(dbState, buildRunQueriesCommand(dbState, queries))
  ).map((queriesResults) =>
    queriesResults[0] ? mapRows(queriesResults[0]) : []
  );

  return { dbState, result, queries };
};

export const runQueries = async <D extends Record<string, unknown>>(
  state: IDbState,
  queries: Sql[]
): Promise<D[][]> => {
  const middlewares: IQueriesMiddleware[] = [
    ...state.queriesMiddlewares,
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
