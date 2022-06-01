import { IDbState } from "./types";

const runAfterTransaction = (
  db: IDbState,
  func: (event: "committed" | "rollbacked") => void
) => {
  if (!db.transaction) {
    throw new Error("Not in transaction.");
  }

  let unsubscribes: (() => void)[] = [];

  const listener = (event: "committed" | "rollbacked") => () => {
    func(event);

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
  func: () => void
) => {
  runAfterTransaction(db, (ev) => {
    if (ev === "committed") {
      func();
    }
  });
};

export const runAfterTransactionRollbacked = (
  db: IDbState,
  func: () => void
) => {
  runAfterTransaction(db, (ev) => {
    if (ev === "rollbacked") {
      func();
    }
  });
};
