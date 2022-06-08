import { IDbState } from "@trong-orm/core";
import { IQueryBuilder, isQueryBuilder } from "@trong-orm/query-builder";
import { Sql } from "@trong-orm/sql";
import { filter, Observable, switchMap, takeUntil } from "rxjs";

import { IMessage } from "./getBroadcastCh";
import { getReactiveState } from "./utils";

export const subscribeToQueries = (
  db: IDbState,
  queries: (Sql | IQueryBuilder)[]
): Observable<unknown> => {
  const { eventsCh$ } = getReactiveState(db);

  const readingTables = new Set(
    queries
      .map((q) => (isQueryBuilder(q) ? q.toSql() : q))
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
    takeUntil(db.sharedState.stopStarted$)
  );
};
