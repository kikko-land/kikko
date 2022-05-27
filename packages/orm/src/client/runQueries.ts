import {
  switchMap,
  Observable,
  filter,
  startWith,
  takeUntil,
  map,
  tap,
} from "rxjs";
import { buildRunQueriesCommand } from "../commands";
import { Sql } from "../Sql";
import { runWorkerCommand } from "./runWorkerCommand";
import { IDbState } from "./types";
import { notifyTablesContentChanged } from "./utils";

export const runQueries = async (state: IDbState, queries: Sql[]) => {
  const writeTables = new Set(
    queries
      .flatMap((q) => q.tables)
      .filter((t) => t.type === "write")
      .map((t) => t.tableName)
  );

  if (state.transaction) {
    for (const t of writeTables) {
      state.transaction.writeToTables.add(t);
    }
  }

  const res = await runWorkerCommand(
    state,
    buildRunQueriesCommand(state, queries)
  );

  if (!state.transaction) {
    // dont await so notification happens after function return
    void notifyTablesContentChanged(state, [...writeTables]);
  }

  return res;
};

export const runQueries$ = (state: IDbState, queries: Sql[]) => {
  const tables = new Set(
    queries
      .flatMap((q) => q.tables)
      .filter((t) => t.type === "read")
      .map((t) => t.tableName)
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
      changesInTables.some((table) => tables.has(table))
    ),
    startWith(undefined),
    switchMap(async () => {
      return runQueries(state, queries);
    }),
    takeUntil(state.sharedState.stop$)
  );
};

export const runQuery = async (state: IDbState, query: Sql) => {
  return (await runQueries(state, [query]))[0];
};
export const runQuery$ = (state: IDbState, query: Sql) => {
  return runQueries$(state, [query]).pipe(map((list) => list[0]));
};
