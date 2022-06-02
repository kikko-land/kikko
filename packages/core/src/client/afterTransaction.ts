import { IDbState, ITransactionState } from "./types";

const runAfterTransaction = (
  db: IDbState,
  func: (
    event: "committed" | "rollbacked",
    db: IDbState,
    transaction: ITransactionState
  ) => void
) => {
  if (!db.transaction) {
    throw new Error("Not in transaction.");
  }

  let unsubscribes: (() => void)[] = [];

  const listener =
    (event: "committed" | "rollbacked") =>
    (db: IDbState, transaction: ITransactionState) => {
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
  func: (db: IDbState, transaction: ITransactionState) => void
) => {
  runAfterTransaction(db, (ev, db, transaction) => {
    if (ev === "committed") {
      func(db, transaction);
    }
  });
};

export const runAfterTransactionRollbacked = (
  db: IDbState,
  func: (db: IDbState, transaction: ITransactionState) => void
) => {
  runAfterTransaction(db, (ev, db, transaction) => {
    if (ev === "rollbacked") {
      func(db, transaction);
    }
  });
};
