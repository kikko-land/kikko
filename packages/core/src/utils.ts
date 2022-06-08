import { IQueryBuilder } from "@trong-orm/query-builder";
import { Sql } from "@trong-orm/sql";

import { castToSql } from "./castToSql";
import { IDbState, IQuery } from "./types";

export const assureDbIsRunning = (state: IDbState, toStart: () => string) => {
  const {
    sharedState: { runningState$, dbName },
  } = state;

  if (runningState$.value !== "running") {
    throw new Error(`Failed to start ${toStart()}, db ${dbName} is stopping`);
  }
};

export const unwrapQueries = (queries: (Sql | IQueryBuilder)[]): IQuery[] => {
  return queries
    .map((q) => castToSql(q))
    .map((q) => ({ text: q.text, values: q.values }));
};
