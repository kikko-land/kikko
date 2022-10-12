import { IDb, ITransaction } from "./types";

export const runAfterTransaction = (
  db: IDb,
  func: (
    event: "committed" | "rollbacked",
    db: IDb,
    transaction: ITransaction
  ) => void
) => {
  if (!db.__state.localState.transactionsState.current) {
    throw new Error("Not in transaction.");
  }
  const transaction = db.__state.localState.transactionsState.current;

  const unsubscribes: (() => void)[] = [];

  const listener =
    (event: "committed" | "rollbacked") =>
    (db: IDb, evTransaction: ITransaction) => {
      if (transaction.id !== evTransaction.id) return;

      func(event, db, transaction);

      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };

  unsubscribes.push(
    db.__state.sharedState.eventsEmitter.on(
      "transactionCommitted",
      listener("committed")
    )
  );

  unsubscribes.push(
    db.__state.sharedState.eventsEmitter.on(
      "transactionRollbacked",
      listener("rollbacked")
    )
  );
};
