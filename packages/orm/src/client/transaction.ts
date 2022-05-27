import { nanoid } from "nanoid";
import { buildTransactionCommand } from "../commands";
import { runWorkerCommand } from "./runWorkerCommand";
import { IDbState } from "./types";
import { notifyTablesContentChanged } from "./utils";

export const runInTransaction = async <T>(
  state: IDbState,
  func: (state: IDbState) => Promise<T>
) => {
  if (state.transaction?.id) {
    // we already in transaction
    return await func(state);
  }

  state = {
    ...state,
    transaction: {
      id: nanoid(),
      writeToTables: new Set(),
    },
  };

  await runWorkerCommand(
    state,
    buildTransactionCommand(state, "startTransaction")
  );

  try {
    const res = await func(state);

    await runWorkerCommand(
      state,
      buildTransactionCommand(state, "commitTransaction")
    );

    // dont await so notification happens after function return
    void notifyTablesContentChanged(state, [
      ...state.transaction!.writeToTables,
    ]);

    return res;
  } catch (e) {
    console.error("Rollback transaction", e);

    await runWorkerCommand(
      state,
      buildTransactionCommand(state, "rollbackTransaction")
    );

    throw e;
  }
};
