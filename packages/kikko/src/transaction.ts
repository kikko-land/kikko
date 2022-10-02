import { ISqlAdapter, sql } from "@kikko-land/sql";

import { acquireJob, releaseJob } from "./job";
import {
  IAtomicTransactionScope,
  IDb,
  ITransaction,
  ITransactionPerformance,
} from "./types";
import { assureDbIsRunning, makeId } from "./utils";

const logTimeIfNeeded = (
  db: IDb,
  transactionId: string,
  performance: ITransactionPerformance
) => {
  const data = [
    `prepareTime=${(performance.prepareTime / 1000).toFixed(4)}`,
    `execTime=${(performance.execTime / 1000).toFixed(4)}`,
    `freeTime=${(performance.freeTime / 1000).toFixed(4)}`,
    `sendTime=${(performance.sendTime / 1000).toFixed(4)}`,
    `receiveTime=${(performance.receiveTime / 1000).toFixed(4)}`,
    `totalTime=${(performance.totalTime / 1000).toFixed(4)}`,
  ].join(" ");

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
  func: (state: IDb) => Promise<T>,
  opts?: { label?: string }
) => {
  const {
    localState: { transactionsState: transactionsLocalState },
    sharedState: { transactionsState: transactionsSharedState, eventsEmitter },
    sharedState,
  } = db.__state;

  // It's indeed that function in same transaction don't need to check db is running
  // Cause all transaction will await to execute on DB before stop
  if (transactionsLocalState.current && transactionsSharedState?.current) {
    if (
      transactionsLocalState.current.id !== transactionsSharedState?.current.id
    ) {
      // Is it possible?
      throw new Error(
        "Internal error: local running transaction is not the same as shared state transaction"
      );
    }

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
        transactionsState: { current: transaction },
      },
    },
  };

  const job = await acquireJob(db.__state.sharedState.jobsState, {
    type: "runTransaction",
    transaction,
    label: opts?.label,
  });

  const startTime = performance.now();
  const transactionState = {
    current: transaction,
    performance: {
      prepareTime: 0,
      execTime: 0,
      freeTime: 0,
      sendTime: 0,
      receiveTime: 0,
      totalTime: 0,
    },
  };
  sharedState.transactionsState = transactionState;

  try {
    await eventsEmitter.emit("transactionWillStart", db, transaction);

    await db.runQuery(
      sql`BEGIN ${sql.raw(transactionType.toUpperCase())} TRANSACTION;`
    );

    await eventsEmitter.emit("transactionStarted", db, transaction);

    try {
      const result = await func(db);

      await eventsEmitter.emit("transactionWillCommit", db, transaction);

      await db.runQuery(sql`COMMIT`);

      await eventsEmitter.emit("transactionCommitted", db, transaction);

      return result;
    } catch (e) {
      console.error("Rollback transaction", e);

      await eventsEmitter.emit("transactionWillRollback", db, transaction);

      await db.runQuery(sql`ROLLBACK`);

      await eventsEmitter.emit("transactionRollbacked", db, transaction);

      throw e;
    }
  } finally {
    transactionState.performance.totalTime = performance.now() - startTime;

    logTimeIfNeeded(db, transaction.id, transactionState.performance);

    releaseJob(db.__state.sharedState.jobsState, job);
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
  func: (scope: IAtomicTransactionScope) => Promise<void> | void,
  opts?: { label?: string; type?: "deferred" | "immediate" | "exclusive" }
): Promise<void> => {
  const {
    localState: { transactionsState: transactionsLocalState },
    sharedState,
  } = db.__state;
  if (transactionsLocalState.current) {
    throw new Error(
      "You are running atomic transaction inside of a transaction. Consider moving atomic transaction call to runAfterTransaction callback."
    );
  }
  const atomicTransaction = initAtomicTransaction();

  await func(atomicTransaction);

  const transaction: ITransaction = {
    id: makeId(),
    type: "atomic",
  };

  const job = await acquireJob(db.__state.sharedState.jobsState, {
    type: "runAtomicTransaction",
    transaction,
    label: opts?.label,
  });

  const transactionState = {
    current: transaction,
    performance: {
      prepareTime: 0,
      execTime: 0,
      freeTime: 0,
      sendTime: 0,
      receiveTime: 0,
      totalTime: 0,
    },
  };
  sharedState.transactionsState = transactionState;

  const startTime = performance.now();
  try {
    await db.__state.sharedState.dbBackend.execAtomicTransaction(
      atomicTransaction,
      opts?.type || "deferred"
    );
  } finally {
    transactionState.performance.totalTime = performance.now() - startTime;

    logTimeIfNeeded(db, transaction.id, transactionState.performance);

    releaseJob(db.__state.sharedState.jobsState, job);
  }
};
