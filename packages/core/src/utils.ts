import { Sql } from "@trong-orm/sql";

import { IDbState, IQuery } from "./types";

export const assureDbIsRunning = (state: IDbState) => {
  const {
    sharedState: { runningState$, dbName },
  } = state;

  if (runningState$.value !== "running") {
    throw new Error(`Failed to start transaction, db ${dbName} is stopping`);
  }
};

export const unwrapQueries = (queries: Sql[]): IQuery[] => {
  return queries.map((q) => ({ text: q.text, values: q.values }));
};
