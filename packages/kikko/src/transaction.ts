import { sql } from "@kikko-land/sql";

import { acquireJob, releaseJob } from "./job";
import { IDb, ITransaction } from "./types";
import { assureDbIsRunning, makeId, unwrapQueries } from "./utils";

export const runInTransactionFunc = async <T>(
  db: IDb,
  transactionType: "deferred" | "immediate" | "exclusive",
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

  const startTime = performance.now();
  try {
    transactionsSharedState.current = transaction;

    await eventsEmitter.emit("transactionWillStart", db, transaction);

    await dbBackend.execQueries(
      unwrapQueries([
        sql`BEGIN ${sql.raw(transactionType.toUpperCase())} TRANSACTION;`,
      ]),
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
    const endTime = performance.now();

    if (!execOpts.log.suppress) {
      console.log(
        `[${
          db.__state.sharedState.dbName
        }][tr_id=${execOpts.log.transactionId.slice(
          0,
          6
        )}] Tranaction finished and caused block for ${(
          (endTime - startTime) /
          1000
        ).toFixed(4)} seconds.`
      );
    }
    releaseJob(db.__state.sharedState.jobsState, job);
  }
};
