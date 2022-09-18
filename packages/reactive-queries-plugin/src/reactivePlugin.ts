import {
  IDbClientPlugin,
  IDbState,
  IQueriesMiddleware,
} from "@kikko-land/kikko";

import { getBroadcastCh } from "./getBroadcastCh";
import { getReactiveState } from "./utils";

const notifyTablesContentChanged = (state: IDbState, tables: string[]) => {
  if (tables.length === 0) return;

  const reactiveState = getReactiveState(state);

  const unsubscribe = reactiveState.rEventsCh.subscribe((ch) => {
    void (async () => {
      if (!ch) return;

      await ch.postMessage({ changesInTables: tables });

      unsubscribe();
    })();
  });
};

export const reactiveQueriesPlugin: (opts?: {
  webMultiTabSupport?: boolean;
}) => IDbClientPlugin = (opts) => (db) => {
  const transactionTables: Record<string, { writeTables: Set<string> }> = {};
  const { dbName, eventsEmitter, runningState } = db.sharedState;

  const webMultiTabSupport =
    opts?.webMultiTabSupport !== undefined ? opts.webMultiTabSupport : true;

  const reactiveQueriesMiddleware: IQueriesMiddleware = (state) => {
    const transaction = state.dbState.localState.transactionsState.current;

    const writeTables = state.queries
      .map((q) => q.toSql())
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
        notifyTablesContentChanged(state.dbState, writeTables);
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
      ...Array.from(transactionTables[transaction.id].writeTables),
    ]);

    delete transactionTables[transaction.id];
  });

  db.sharedState.reactiveQueriesState = {
    rEventsCh: getBroadcastCh(
      dbName + "-reactiveQueriesPlugin",
      webMultiTabSupport,
      runningState
    ),
  };

  return {
    ...db,
    localState: {
      ...db.localState,
      queriesMiddlewares: [
        ...db.localState.queriesMiddlewares,
        reactiveQueriesMiddleware,
      ],
    },
  };
};
