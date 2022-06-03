import { sql } from "@trong-orm/sql";
import { nanoid } from "nanoid";

import { acquireJob, releaseJob } from "./job";
import { IDbState, ITransaction } from "./types";
import { assureDbIsRunning, unwrapQueries } from "./utils";

export const runInTransaction = async <T>(
  state: IDbState,
  func: (state: IDbState) => Promise<T>
) => {
  const {
    localState: { transactionsState: transactionsLocalState },
    sharedState: {
      transactionsState: transactionsSharedState,
      eventsEmitter,
      dbBackend,
    },
  } = state;

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
    return await func(state);
  }

  assureDbIsRunning(state);

  const transaction: ITransaction = {
    id: nanoid(),
  };

  state = {
    ...state,
    localState: {
      ...state.localState,
      transactionsState: { current: transaction },
    },
  };

  const job = await acquireJob(state.sharedState.jobsState, {
    type: "runTransaction",
    transaction,
  });

  const execOpts = {
    log: {
      suppress: Boolean(state.localState.suppressLog),
      transactionId: transaction.id,
    },
  };

  try {
    transactionsSharedState.current = transaction;

    await eventsEmitter.emit("transactionWillStart", state, transaction);

    await dbBackend.execQueries(
      unwrapQueries([sql`BEGIN TRANSACTION;`]),
      execOpts
    );

    await eventsEmitter.emit("transactionStarted", state, transaction);

    try {
      const res = await func(state);

      await eventsEmitter.emit("transactionWillCommit", state, transaction);

      await dbBackend.execQueries(unwrapQueries([sql`COMMIT`]), execOpts);

      await eventsEmitter.emit("transactionCommitted", state, transaction);

      return res;
    } catch (e) {
      console.error("Rollback transaction", e);

      await eventsEmitter.emit("transactionWillRollback", state, transaction);

      await dbBackend.execQueries(unwrapQueries([sql`ROLLBACK`]), execOpts);

      await eventsEmitter.emit("transactionRollbacked", state, transaction);

      throw e;
    }
  } finally {
    releaseJob(state.sharedState.jobsState, job);
  }
};
