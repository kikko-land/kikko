import {
  IDb,
  IDbClientPlugin,
  IQueriesMiddleware,
  ISqlAdapter,
} from "@kikko-land/kikko";

import { getBroadcastCh } from "./getBroadcastCh";
import { getReactiveState } from "./utils";

const notifyTablesContentChanged = (db: IDb, tables: string[]) => {
  if (tables.length === 0) return;

  const reactiveState = getReactiveState(db);

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
  const { dbName, eventsEmitter, runningState } = db.__state.sharedState;

  const webMultiTabSupport =
    opts?.webMultiTabSupport !== undefined ? opts.webMultiTabSupport : true;

  const reactiveQueriesMiddleware: IQueriesMiddleware = async (state) => {
    const transaction = state.db.__state.localState.transactionState.current;

    const writeTables = (
      state.queries.type === "usual"
        ? state.queries.values
        : [state.queries.query]
    )
      .filter((q) => "toSql" in q)
      .map((q) => {
        return (q as ISqlAdapter).toSql();
      })
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
        try {
          return await state.next(state);
        } finally {
          notifyTablesContentChanged(state.db, writeTables);
        }
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

  db.__state.sharedState.reactiveQueriesState = {
    rEventsCh: getBroadcastCh(
      dbName + "-reactiveQueriesPlugin",
      webMultiTabSupport,
      runningState
    ),
  };

  return {
    ...db,
    __state: {
      ...db.__state,
      localState: {
        ...db.__state.localState,
        queriesMiddlewares: [
          ...db.__state.localState.queriesMiddlewares,
          reactiveQueriesMiddleware,
        ],
      },
    },
  };
};
