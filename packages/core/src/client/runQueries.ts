import { Sql } from "@trong/sql";

import { buildRunQueriesCommand } from "../commands";
import { runWorkerCommand } from "./runWorkerCommand";
import {
  IDbState,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
} from "./types";

const runQueriesMiddleware: IQueriesMiddleware = async ({
  dbState,
  queries,
}) => {
  const result = await runWorkerCommand(
    dbState,
    buildRunQueriesCommand(dbState, queries)
  );

  return { dbState, result, queries };
};

export const runQueries = async (state: IDbState, queries: Sql[]) => {
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
    .result;
};

export const runQuery = async (state: IDbState, query: Sql) => {
  return (await runQueries(state, [query]))[0];
};
