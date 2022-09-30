import { ISql } from "@kikko-land/sql";

import { IDb, IQuery } from "./types";

export const assureDbIsRunning = (state: IDb, toStart: () => string) => {
  const {
    __state: {
      sharedState: { runningState, dbName },
    },
  } = state;

  if (runningState.value !== "running") {
    throw new Error(`Failed to start ${toStart()}, db ${dbName} is stopping`);
  }
};

export const unwrapQueries = (queries: ISql[]): IQuery[] => {
  return queries.map((q) => q.preparedQuery);
};

export function makeId() {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < 32; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
