import { sql } from "@trong-orm/sql";
import { nanoid } from "nanoid";

import { buildRunQueriesCommand } from "../commands";
import { acquireJob, releaseJob } from "./job";
import { runWorkerCommand } from "./runWorkerCommand";
import { IDbState, ITransaction } from "./types";

export const runInTransaction = async <T>(
  state: IDbState,
  func: (state: IDbState) => Promise<T>
) => {
  const {
    localState: { transactionsState: transactionsLocalState },
    sharedState: { transactionsState: transactionsSharedState, eventsEmitter },
  } = state;

  if (
    transactionsLocalState.currentlyRunning &&
    transactionsSharedState.currentlyRunning
  ) {
    if (
      transactionsLocalState.currentlyRunning.id !==
      transactionsSharedState.currentlyRunning.id
    ) {
      // Is it possible?
      throw new Error(
        "Internal error: local running transaction is not the same as shared state transaction"
      );
    }

    // we already in same transaction
    return await func(state);
  }

  const transaction: ITransaction = {
    id: nanoid(),
  };

  state = {
    ...state,
    localState: {
      ...state.localState,
      transactionsState: { currentlyRunning: transaction },
    },
  };

  const job = await acquireJob(state.sharedState.jobsState, {
    type: "runTransaction",
    transaction,
  });

  try {
    transactionsSharedState.currentlyRunning = transaction;

    await eventsEmitter.emit("transactionWillStart", state, transaction);

    await runWorkerCommand(
      state,
      buildRunQueriesCommand(state, [sql`BEGIN TRANSACTION;`])
    );

    await eventsEmitter.emit("transactionStarted", state, transaction);

    try {
      const res = await func(state);

      await eventsEmitter.emit("transactionWillCommit", state, transaction);

      await runWorkerCommand(
        state,
        buildRunQueriesCommand(state, [sql`COMMIT`])
      );

      await eventsEmitter.emit("transactionCommitted", state, transaction);

      return res;
    } catch (e) {
      console.error("Rollback transaction", e);

      await eventsEmitter.emit("transactionWillRollback", state, transaction);

      await runWorkerCommand(
        state,
        buildRunQueriesCommand(state, [sql`rollbackTransaction`])
      );

      await eventsEmitter.emit("transactionRollbacked", state, transaction);

      throw e;
    }
  } finally {
    releaseJob(state.sharedState.jobsState, job);
  }
};
