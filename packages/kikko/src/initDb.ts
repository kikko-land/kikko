import { IPrimitiveValue, ISql, ISqlAdapter } from "@kikko-land/boono-sql";

import { runAfterTransaction } from "./afterTransaction";
import { createNanoEvents } from "./createNanoEvents";
import { reactiveVar } from "./reactiveVar";
import { runQueries } from "./runQueries";
import { execAtomicTransaction, runInTransactionFunc } from "./transaction";
import {
  IAtomicTransactionScope,
  IDb,
  IDbBackend,
  IKikkoEvents,
  ILogFns,
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
  logFns?: ILogFns;
};

const colors = ["yellow", "cyan", "magenta"];

export const initDbClient = async ({
  dbName,
  plugins,
  queriesMiddlewares,
  dbBackend,
  suppressLog,
  logFns: _logFns,
}: IInitDbClientConfig): Promise<IDb> => {
  const logFns: ILogFns = _logFns || {
    logQuery: (msg: string, i: number | undefined) => {
      const color =
        typeof i === "number" ? colors[i % colors.length] : undefined;

      console.info(
        ...(color
          ? [
              msg,
              `color: ${color}; background-color: #202124; padding: 2px 4px; border-radius: 2px`,
            ]
          : [msg, `padding: 0`])
      );
    },
    logError: (msg: string, context: unknown) => {
      console.error(msg, context);
    },
    logTrFinish: (msg: string) => {
      console.info(
        msg,
        `color: #fff; background-color: #1da1f2; padding: 2px 4px; border-radius: 2px`
      );
    },
  };

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
        logFns,
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
    async runInAtomicTransaction(
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
      const res = await runQueries(this, {
        type: "usual",
        values: queries.map((q) => q.toSql()),
      });
      return res.result.map(({ rows }) => rows) as D[][];
    },
    async runQuery<D extends Record<string, unknown>>(
      query: ISqlAdapter
    ): Promise<D[]> {
      return (await this.runQueries<D>([query]))[0];
    },
    async runPreparedQuery<D extends Record<string, unknown>>(
      query: ISql,
      preparedValues: IPrimitiveValue[][]
    ): Promise<D[][]> {
      const res = await runQueries(this, {
        type: "prepared",
        query,
        preparedValues,
      });

      return res.result.map(({ rows }) => rows) as D[][];
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
