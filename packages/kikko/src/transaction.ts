import { sql } from "@kikko-land/sql";

import { acquireJob, releaseJob } from "./job";
import { IDb, ITransaction } from "./types";
import { assureDbIsRunning, makeId, unwrapQueries } from "./utils";

const runInTransactionFunc = async <T>(
  db: IDb,
  transactionType: "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE",
  func: (state: IDb) => Promise<T>,
  opts?: { label?: string }
) => {
  const {
    localState: { transactionsState: transactionsLocalState },
    sharedState: {
      transactionsState: transactionsSharedState,
      eventsEmitter,
      dbBackend,
    },
  } = db.__state;

  // It's indeed that function in same transaction don't need to check db is running
  // Cause all transaction will await to execute on DB before stop
  if (transactionsLocalState.current && transactionsSharedState.current) {
    if (
      transactionsLocalState.current.id !== transactionsSharedState.current.id
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

  const execOpts = {
    log: {
      suppress: Boolean(db.__state.localState.suppressLog),
      transactionId: transaction.id,
    },
  };

  try {
    transactionsSharedState.current = transaction;

    await eventsEmitter.emit("transactionWillStart", db, transaction);

    await dbBackend.execQueries(
      unwrapQueries([sql`BEGIN ${sql.raw(transactionType)} TRANSACTION;`]),
      execOpts
    );

    await eventsEmitter.emit("transactionStarted", db, transaction);

    try {
      const res = await func(db);

      await eventsEmitter.emit("transactionWillCommit", db, transaction);

      await dbBackend.execQueries(unwrapQueries([sql`COMMIT`]), execOpts);

      await eventsEmitter.emit("transactionCommitted", db, transaction);

      return res;
    } catch (e) {
      console.error("Rollback transaction", e);

      await eventsEmitter.emit("transactionWillRollback", db, transaction);

      await dbBackend.execQueries(unwrapQueries([sql`ROLLBACK`]), execOpts);

      await eventsEmitter.emit("transactionRollbacked", db, transaction);

      throw e;
    }
  } finally {
    releaseJob(db.__state.sharedState.jobsState, job);
  }
};

// By default it is deferred
export const runInDeferredTransaction = <T>(
  state: IDb,
  func: (state: IDb) => Promise<T>,
  opts?: { label?: string }
) => runInTransactionFunc(state, "DEFERRED", func, opts);
export const runInImmediateTransaction = <T>(
  state: IDb,
  func: (state: IDb) => Promise<T>,
  opts?: { label?: string }
) => runInTransactionFunc(state, "IMMEDIATE", func, opts);
export const runInExclusiveTransaction = <T>(
  state: IDb,
  func: (state: IDb) => Promise<T>,
  opts?: { label?: string }
) => runInTransactionFunc(state, "EXCLUSIVE", func, opts);

export const runInTransaction = <T>(
  state: IDb,
  func: (state: IDb) => Promise<T>,
  opts?: { label?: string }
) => runInDeferredTransaction(state, func, opts);
