import { Sql } from "@trong/sql";
import { filter, map, Observable, startWith, switchMap, takeUntil } from "rxjs";

import { buildRunQueriesCommand } from "../commands";
import { runWorkerCommand } from "./runWorkerCommand";
import {
  IDbState,
  INextQueriesMiddleware,
  IQueriesMiddleware,
  IQueriesMiddlewareState,
} from "./types";
import { notifyTablesContentChanged } from "./utils";

const runQueriesMiddleware: IQueriesMiddleware = async ({
  dbState,
  queries,
  next,
}) => {
  const result = await runWorkerCommand(
    dbState,
    buildRunQueriesCommand(dbState, queries)
  );

  return { dbState, result, queries };
};

export const runQueries = async (state: IDbState, queries: Sql[]) => {
  const writeTables = new Set(
    queries
      .filter((q) => q.isModifyQuery)
      .flatMap((q) => q.tables)
      .map((t) => t.name)
  );

  const middlewares: IQueriesMiddleware[] = [
    ...state.queriesMiddlewares,
    runQueriesMiddleware,
  ];

  let toCall: INextQueriesMiddleware = async (args) => args;

  for (const middleware of middlewares) {
    const currentCall = toCall;

    toCall = (args: IQueriesMiddlewareState) =>
      middleware({ ...args, next: currentCall });
  }

  if (state.transaction) {
    for (const t of writeTables) {
      state.transaction.writeToTables.add(t);
    }
  }

  if (!state.transaction && writeTables.size !== 0) {
    // dont await so notification happens after function return
    void notifyTablesContentChanged(state, [...writeTables]);
  }

  return (await toCall({ dbState: state, result: [], queries: queries }))
    .result;
};

export const runQuery = async (state: IDbState, query: Sql) => {
  return (await runQueries(state, [query]))[0];
};

export const subscribeToQueries$ = (
  state: IDbState,
  queries: Sql[]
): Observable<unknown> => {
  const readingTables = new Set(
    queries
      .filter((q) => q.isReadQuery)
      .flatMap((q) => q.tables)
      .map((t) => t.name)
  );

  return state.sharedState.eventsCh$.pipe(
    switchMap((ch) => {
      return new Observable<string[]>((subscriber) => {
        const func = (data: string[]) => {
          subscriber.next(data);
        };

        ch.addEventListener(func);

        return () => {
          ch.removeEventListener(func);
        };
      });
    }),
    filter((changesInTables) =>
      changesInTables.some((table) => readingTables.has(table))
    ),
    takeUntil(state.sharedState.stop$)
  );
};

export const runQueries$ = (state: IDbState, queries: Sql[]) => {
  return subscribeToQueries$(state, queries).pipe(
    startWith(undefined),
    switchMap(async () => {
      return runQueries(state, queries);
    })
  );
};

export const runQuery$ = (state: IDbState, query: Sql) => {
  return runQueries$(state, [query]).pipe(map((list) => list[0]));
};
