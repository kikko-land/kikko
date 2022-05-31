import { IDbState } from "./types";

export const runAfterTransaction = (
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
