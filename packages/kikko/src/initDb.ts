import { ISqlAdapter } from "@kikko-land/boono-sql";

import { runAfterTransaction } from "./afterTransaction";
import { createNanoEvents } from "./createNanoEvents";
import { reactiveVar } from "./reactiveVar";
import { runQueries } from "./runQueries";
import { withSuppressedLog } from "./suppressLog";
import { execAtomicTransaction, runInTransactionFunc } from "./transaction";
import {
  IAtomicTransactionScope,
  IDb,
  IDbBackend,
  IKikkoEvents,
  IQueriesMiddleware,
  ITransaction,
} from "./types";
import { makeId } from "./utils";

export type IDbClientPlugin = (state: IDb) => IDb;

export type IInitDbClientConfig = {
  dbName: string;
  dbBackend: Promise<IDbBackend> | IDbBackend;
  plugins?: IDbClientPlugin[];
  queriesMiddlewares?: IQueriesMiddleware[];
  suppressLog?: boolean;
};

export const initDbClient = async ({
  dbName,
  plugins,
  queriesMiddlewares,
  dbBackend,
  suppressLog,
}: IInitDbClientConfig): Promise<IDb> => {
  const runningState = reactiveVar<"running" | "stopping" | "stopped">(
    "running",
    { label: "runningState" }
  );
  const dbBackendCalled = (await dbBackend)({
    dbName,
  });

  const db: IDb = {
    __state: {
      sharedState: {
        clientId: makeId(),
        dbBackend: dbBackendCalled,
        dbName,
        runningState: runningState,
        eventsEmitter: createNanoEvents<IKikkoEvents>(),

        transactionsStates: { byId: {} },
      },
      localState: {
        queriesMiddlewares: queriesMiddlewares || [],
        transactionState: {},
        suppressLog: Boolean(suppressLog),
      },
    },
    runInTransaction<T>(
      func: (state: IDb) => Promise<T>,
      opts?: { type?: "deferred" | "immediate" | "exclusive" }
    ): Promise<T> {
      return runInTransactionFunc<T>(this, opts?.type || "deferred", func);
    },
    async runAtomicTransaction(
      func:
        | ((scope: IAtomicTransactionScope) => Promise<void> | void)
        | ISqlAdapter[],

      opts?: { label?: string; type?: "deferred" | "immediate" | "exclusive" }
    ): Promise<void> {
      return await execAtomicTransaction(this, opts?.type || "deferred", func);
    },
    async runQueries<D extends Record<string, unknown>>(
      queries: ISqlAdapter[]
    ): Promise<D[][]> {
      const res = await runQueries(this, queries);
      return res.result.map(({ rows }) => rows) as D[][];
    },
    async runQuery<D extends Record<string, unknown>>(
      query: ISqlAdapter
    ): Promise<D[]> {
      return (await this.runQueries<D>([query]))[0];
    },
    runAfterTransactionCommitted(
      func: (db: IDb, transaction: ITransaction) => void
    ) {
      return runAfterTransaction(this, (ev, db, transaction) => {
        if (ev === "committed") {
          func(db, transaction);
        }
      });
    },
    runAfterTransactionRollbacked(
      func: (db: IDb, transaction: ITransaction) => void
    ) {
      runAfterTransaction(db, (ev, db, transaction) => {
        if (ev === "rollbacked") {
          func(db, transaction);
        }
      });
    },
  };

  let currentState = db;
  const getRunningState = () => db.__state.sharedState.runningState.value;

  if (getRunningState() !== "running") return db;

  await dbBackendCalled.initialize();

  if (getRunningState() !== "running") return db;

  for (const plugin of plugins || []) {
    currentState = plugin(currentState);
  }

  await db.__state.sharedState.eventsEmitter.emit("initialized", db);

  return currentState;
};

export const stopDb = async (state: IDb) => {
  state.__state.sharedState.runningState.value = "stopping";

  await state.__state.sharedState.dbBackend.stop();

  state.__state.sharedState.runningState.value = "stopped";

  queueMicrotask(() => {
    state.__state.sharedState.runningState.stop();
  });
};
