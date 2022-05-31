import { nanoid } from "nanoid";

import { buildTransactionCommand } from "../commands";
import { runWorkerCommand } from "./runWorkerCommand";
import { IDbState } from "./types";

export const runInTransaction = async <T>(
  state: IDbState,
  func: (state: IDbState) => Promise<T>
) => {
  if (state.transaction?.id) {
    // we already in transaction
    return await func(state);
  }

  const eventsEmitter = state.sharedState.eventsEmitter;

  const transaction = {
    id: nanoid(),
  };

  state = {
    ...state,
    transaction,
  };

  await eventsEmitter.emit("transactionWillStart", state, transaction);

  await runWorkerCommand(
    state,
    buildTransactionCommand(state, "startTransaction")
  );

  await eventsEmitter.emit("transactionStarted", state, transaction);

  try {
    const res = await func(state);

    await eventsEmitter.emit("transactionWillCommit", state, transaction);

    await runWorkerCommand(
      state,
      buildTransactionCommand(state, "commitTransaction")
    );

    await eventsEmitter.emit("transactionCommitted", state, transaction);

    // dont await so notification happens after function return

    return res;
  } catch (e) {
    console.error("Rollback transaction", e);

    await eventsEmitter.emit("transactionWillRollback", state, transaction);

    await runWorkerCommand(
      state,
      buildTransactionCommand(state, "rollbackTransaction")
    );

    await eventsEmitter.emit("transactionRollbacked", state, transaction);

    throw e;
  }
};
