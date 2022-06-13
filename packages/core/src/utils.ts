import { Sql } from "@trong-orm/sql";

import { IDbState, IQuery } from "./types";

export const assureDbIsRunning = (state: IDbState, toStart: () => string) => {
  const {
    sharedState: { runningState$, dbName },
  } = state;

  if (runningState$.value !== "running") {
    throw new Error(`Failed to start ${toStart()}, db ${dbName} is stopping`);
  }
};

export const unwrapQueries = (queries: Sql[]): IQuery[] => {
  return queries.map((q) => ({ text: q.text, values: q.values }));
};
