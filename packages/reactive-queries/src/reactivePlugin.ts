import { IDbPlugin, IDbState, IQueriesMiddleware } from "@trong/core";
import { first, lastValueFrom, switchMap } from "rxjs";

import { getBroadcastCh } from "./getBroadcastCh";
import { getReactiveState } from "./utils";

const notifyTablesContentChanged = async (
  state: IDbState,
  tables: string[]
) => {
  if (tables.length === 0) return;

  const reactiveState = getReactiveState(state);

  return lastValueFrom(
    reactiveState.eventsCh$.pipe(
      first(),
      switchMap(async (ch) => {
        await ch.postMessage({ changesInTables: tables });
      })
    )
  );
};

export const reactiveQueriesPlugin: IDbPlugin = (db) => {
  const transactionTables: Record<string, { writeTables: Set<string> }> = {};
  const { dbName, eventsEmitter, stop$ } = db.sharedState;

  const reactiveQueriesMiddleware: IQueriesMiddleware = (state) => {
    const transaction = state.dbState.transaction;

    const writeTables = state.queries
      .filter((q) => q.isModifyQuery)
      .flatMap((q) => q.tables)
      .flatMap((def) => [
        def.name,
        ...def.dependsOnTables.map(({ name }) => name),
      ]);

    if (writeTables.length !== 0) {
      if (transaction) {
        if (!transactionTables[transaction.id]) {
          throw new Error(
            "Internal error: records with transactionId key was not created"
          );
        }

        for (const t of writeTables) {
          transactionTables[transaction.id].writeTables.add(t);
        }
      } else {
        // dont await so notification happens after function return
        void notifyTablesContentChanged(state.dbState, writeTables);
      }
    }

    return state.next(state);
  };

  eventsEmitter.on("transactionWillStart", (_db, transaction) => {
    transactionTables[transaction.id] = { writeTables: new Set() };
  });

  eventsEmitter.on("transactionRollbacked", (_db, transaction) => {
    delete transactionTables[transaction.id];
  });

  eventsEmitter.on("transactionCommitted", (db, transaction) => {
    if (!transactionTables[transaction.id]) {
      throw new Error(
        "Internal error: records with transactionId key was not created"
      );
    }

    void notifyTablesContentChanged(db, [
      ...transactionTables[transaction.id].writeTables,
    ]);

    delete transactionTables[transaction.id];
  });

  db.sharedState.reactiveQueriesState = {
    eventsCh$: getBroadcastCh(dbName + "-reactiveQueriesPlugin", stop$),
  };

  return {
    ...db,
    queriesMiddlewares: [...db.queriesMiddlewares, reactiveQueriesMiddleware],
  };
};
