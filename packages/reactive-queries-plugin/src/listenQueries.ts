import { IDbState, runQueries } from "@kikko-land/kikko";
import { ISqlAdapter } from "@kikko-land/sql";
import { filter, Observable, startWith, switchMap, takeUntil } from "rxjs";

import { IMessage } from "./getBroadcastCh";
import { getReactiveState } from "./utils";

export const listenQueries = <D extends Record<string, unknown>>(
  db: IDbState,
  queries: ISqlAdapter[]
): Observable<D[][]> => {
  const { eventsCh$ } = getReactiveState(db);

  const readingTables = new Set(
    queries
      .map((q) => q.toSql())
      .flatMap((q) => q.tables)
      .map((t) => t.name)
  );

  return eventsCh$.pipe(
    switchMap((ch) => {
      return new Observable<IMessage>((subscriber) => {
        const func = (data: IMessage) => {
          subscriber.next(data);
        };

        ch.addEventListener(func);

        return () => {
          ch.removeEventListener(func);
        };
      });
    }),
    filter(({ changesInTables }) =>
      changesInTables.some((table) => readingTables.has(table))
    ),
    startWith(undefined), // to exec query at start
    switchMap(async () => {
      return runQueries<D>(db, queries);
    }),
    takeUntil(db.sharedState.stopStarted$)
  );
};
