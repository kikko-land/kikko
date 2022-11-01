import { ISqlAdapter, sql } from "@kikko-land/boono-sql";

import { acquireJob, IJob, IJobsState, releaseJob } from "./job";
import { ReactiveVar } from "./reactiveVar";
import { runQueries } from "./runQueries";
import {
  IAtomicTransactionScope,
  IDb,
  ITransaction,
  ITransactionOpts,
  ITransactionPerformance,
} from "./types";
import { assureDbIsRunning, makeId } from "./utils";

// Let' make it global for all DBs to avoid transaction colors duplication
let transactionsCounter = 0;

const logTimeIfNeeded = (
  db: IDb,
  transactionId: string,
  performance: ITransactionPerformance
) => {
  if (db.__state.localState.suppressLog) return;

  const data = [
    performance.prepareTime === undefined
      ? ""
      : `prepareTime=${(performance.prepareTime / 1000).toFixed(4)}`,
    performance.execTime === undefined
      ? ""
      : `execTime=${(performance.execTime / 1000).toFixed(4)}`,
    performance.freeTime === undefined
      ? ""
      : `freeTime=${(performance.freeTime / 1000).toFixed(4)}`,
    performance.sendTime === undefined
      ? ""
      : `sendTime=${(performance.sendTime / 1000).toFixed(4)}`,
    performance.receiveTime === undefined
      ? ""
      : `receiveTime=${(performance.receiveTime / 1000).toFixed(4)}`,
    performance.blockTime === undefined
      ? ""
      : `blockTime=${(performance.blockTime / 1000).toFixed(4)}`,
    `totalTime=${(performance.totalTime / 1000).toFixed(4)}`,
  ]
    .filter((v) => v.length !== 0)
    .join(" ");

  console.log(
    `%c[${db.__state.sharedState.dbName}][tr_id=${transactionId.slice(
      0,
      6
    )}] Transaction finished with ${data}`,
    `color: #fff; background-color: #1da1f2; padding: 2px 4px; border-radius: 2px`
  );
};

export const runInTransactionFunc = async <T>(
  db: IDb,
  transactionType: "deferred" | "immediate" | "exclusive",
  func: (state: IDb) => Promise<T>
) => {
  const {
    localState: { transactionState: transactionsLocalState },
    sharedState: { eventsEmitter, transactionsStates },
    sharedState,
  } = db.__state;

  // It's indeed that function in same transaction don't need to check db is running
  // Cause all transaction will await to execute on DB before stop
  if (transactionsLocalState.current) {
    // we already in same transaction
    return await func(db);
  }

  assureDbIsRunning(db, () => "transaction");

  const transaction: ITransaction = {
    id: makeId(),
    type: "async",
  };

  db = {
    ...db,
    __state: {
      ...db.__state,
      localState: {
        ...db.__state.localState,
        transactionState: { current: transaction },
      },
    },
  };

  const startTime = performance.now();

  const transactionState = {
    i: transactionsCounter++,
    current: transaction,
    performance: {
      prepareTime: 0,
      execTime: 0,
      freeTime: 0,
      sendTime: 0,
      receiveTime: 0,
      totalTime: 0,
      blockTime: 0,
    },
  };

  transactionsStates.byId[transaction.id] = transactionState;

  try {
    await eventsEmitter.emit("transactionWillStart", db, transaction);

    await runQueries(
      db,
      [sql`BEGIN ${sql.raw(transactionType.toLocaleUpperCase())} TRANSACTION`],
      {
        transactionId: transaction.id,
        containsTransactionStart: true,
        containsTransactionFinish: false,
        containsTransactionRollback: false,
        rollbackOnFail: false,
      }
    );

    await eventsEmitter.emit("transactionStarted", db, transaction);

    try {
      const result = await func(db);

      await eventsEmitter.emit("transactionWillCommit", db, transaction);

      await runQueries(db, [sql`COMMIT`], {
        transactionId: transaction.id,
        containsTransactionStart: false,
        containsTransactionFinish: true,
        containsTransactionRollback: false,
        rollbackOnFail: false,
      });

      await eventsEmitter.emit("transactionCommitted", db, transaction);

      return result;
    } catch (e) {
      console.error("Rollback transaction", e);

      await eventsEmitter.emit("transactionWillRollback", db, transaction);

      try {
        await runQueries(db, [sql`ROLLBACK`], {
          transactionId: transaction.id,
          containsTransactionStart: false,
          containsTransactionFinish: false,
          containsTransactionRollback: true,
          rollbackOnFail: false,
        });
      } catch (e) {
        console.warn("Rollback transaction failed", e);
      }

      await eventsEmitter.emit("transactionRollbacked", db, transaction);

      throw e;
    }
  } finally {
    transactionState.performance.totalTime = performance.now() - startTime;

    logTimeIfNeeded(db, transaction.id, transactionState.performance);

    delete transactionsStates.byId[transaction.id];
  }
};

const initAtomicTransaction = (): IAtomicTransactionScope => {
  return {
    __state: {
      queries: [],
    },
    addQuery(q: ISqlAdapter): void {
      this.__state.queries.push(q);
    },
  };
};

export const execAtomicTransaction = async (
  db: IDb,
  transactionType: "deferred" | "immediate" | "exclusive",
  funcOrQueries:
    | ((scope: IAtomicTransactionScope) => Promise<void> | void)
    | ISqlAdapter[]
): Promise<void> => {
  const {
    localState: { transactionState: transactionsLocalState },
    sharedState: { eventsEmitter, transactionsStates },
    sharedState,
  } = db.__state;
  if (transactionsLocalState.current) {
    throw new Error(
      "You are running atomic transaction inside of a transaction. Consider moving atomic transaction call to runAfterTransaction callback."
    );
  }

  const inputQueries = await (async () => {
    if (Array.isArray(funcOrQueries)) {
      return funcOrQueries;
    } else {
      const atomicTransaction = initAtomicTransaction();
      await funcOrQueries(atomicTransaction);
      return atomicTransaction.__state.queries;
    }
  })();

  const transaction: ITransaction = {
    id: makeId(),
    type: "atomic",
  };

  const transactionState = {
    i: transactionsCounter++,
    current: transaction,
    performance: {
      prepareTime: 0,
      execTime: 0,
      freeTime: 0,
      sendTime: 0,
      receiveTime: 0,
      totalTime: 0,
      blockTime: 0,
    },
  };

  db = {
    ...db,
    __state: {
      ...db.__state,
      localState: {
        ...db.__state.localState,
        transactionState: { current: transaction },
      },
    },
  };

  transactionsStates.byId[transaction.id] = transactionState;

  const startTime = performance.now();

  try {
    await eventsEmitter.emit("transactionWillStart", db, transaction);
    await eventsEmitter.emit("transactionStarted", db, transaction);

    await runQueries(
      db,
      [
        sql`BEGIN ${sql.raw(transactionType.toUpperCase())} TRANSACTION`,
        ...inputQueries,
        sql`COMMIT`,
      ],
      {
        transactionId: transaction.id,
        containsTransactionStart: true,
        containsTransactionFinish: true,
        containsTransactionRollback: false,
        rollbackOnFail: true,
      }
    );

    await eventsEmitter.emit("transactionWillCommit", db, transaction);
    await eventsEmitter.emit("transactionCommitted", db, transaction);
  } catch (e) {
    console.error("Rollback transaction", e);

    await eventsEmitter.emit("transactionWillRollback", db, transaction);
    await eventsEmitter.emit("transactionRollbacked", db, transaction);

    throw e;
  } finally {
    transactionState.performance.totalTime = performance.now() - startTime;

    logTimeIfNeeded(db, transaction.id, transactionState.performance);

    delete transactionsStates.byId[transaction.id];
  }
};
