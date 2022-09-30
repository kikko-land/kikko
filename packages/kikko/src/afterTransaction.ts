import { IDb, ITransaction } from "./types";

const runAfterTransaction = (
  db: IDb,
  func: (
    event: "committed" | "rollbacked",
    db: IDb,
    transaction: ITransaction
  ) => void
) => {
  if (!db.__state.localState.transactionsState) {
    throw new Error("Not in transaction.");
  }

  const unsubscribes: (() => void)[] = [];

  const listener =
    (event: "committed" | "rollbacked") =>
    (db: IDb, transaction: ITransaction) => {
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

export const runAfterTransactionCommitted = (
  db: IDb,
  func: (db: IDb, transaction: ITransaction) => void
) => {
  runAfterTransaction(db, (ev, db, transaction) => {
    if (ev === "committed") {
      func(db, transaction);
    }
  });
};

export const runAfterTransactionRollbacked = (
  db: IDb,
  func: (db: IDb, transaction: ITransaction) => void
) => {
  runAfterTransaction(db, (ev, db, transaction) => {
    if (ev === "rollbacked") {
      func(db, transaction);
    }
  });
};
