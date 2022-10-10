import { IDbState, ITransaction } from "./types";

const runAfterTransaction = (
  db: IDbState,
  func: (
    event: "committed" | "rollbacked",
    db: IDbState,
    transaction: ITransaction
  ) => void
) => {
  if (!db.localState.transactionsState) {
    throw new Error("Not in transaction.");
  }

  const unsubscribes: (() => void)[] = [];

  const listener =
    (event: "committed" | "rollbacked") =>
    (db: IDbState, transaction: ITransaction) => {
      func(event, db, transaction);

      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };

  unsubscribes.push(
    db.sharedState.eventsEmitter.on(
      "transactionCommitted",
      listener("committed")
    )
  );

  unsubscribes.push(
    db.sharedState.eventsEmitter.on(
      "transactionRollbacked",
      listener("rollbacked")
    )
  );
};

export const runAfterTransactionCommitted = (
  db: IDbState,
  func: (db: IDbState, transaction: ITransaction) => void
) => {
  runAfterTransaction(db, (ev, db, transaction) => {
    if (ev === "committed") {
      func(db, transaction);
    }
  });
};

export const runAfterTransactionRollbacked = (
  db: IDbState,
  func: (db: IDbState, transaction: ITransaction) => void
) => {
  runAfterTransaction(db, (ev, db, transaction) => {
    if (ev === "rollbacked") {
      func(db, transaction);
    }
  });
};
