import { IDbState, IWithToSql } from "@trong-orm/core";
import { filter, Observable, switchMap, takeUntil } from "rxjs";

import { IMessage } from "./getBroadcastCh";
import { getReactiveState } from "./utils";

export const subscribeToQueries = (
  db: IDbState,
  queries: IWithToSql[]
): Observable<unknown> => {
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
    takeUntil(db.sharedState.stopStarted$)
  );
};
