import { IDbBackend, IQuery, IQueryResult } from "@kikko-land/kikko";
import SQLite from "tauri-plugin-sqlite-api";

export const tauriBackend = (path: (dbName: string) => string): IDbBackend => ({
  dbName,
}) => {
  let isStopped = true;
  let db: SQLite | undefined = undefined;

  return {
    async initialize() {
      if (isStopped) throw new Error("Failed to start DB cause it is stopped");

      db = await SQLite.open(path(dbName));
    },
    async execQueries(
      queries: IQuery[],
      opts: {
        log: {
          suppress: boolean;
          transactionId?: string;
        };
      }
    ) {
      if (!db) {
        throw new Error(
          `Failed to run queries: ${queries
            .map((q) => q.text)
            .join(" ")}, db not initialized`
        );
      }

      const result: IQueryResult[] = [];

      for (const q of queries) {
        const startTime = performance.now();

        result.push(await db.select<IQueryResult>(q.text, q.values));

        const end = performance.now();

        if (!opts.log.suppress) {
          console.info(
            `[${dbName}]${
              opts.log.transactionId
                ? `[tr_id=${opts.log.transactionId.slice(0, 6)}]`
                : ""
            } ` +
              queries.map((q) => q.text).join(" ") +
              " Time: " +
              ((end - startTime) / 1000).toFixed(4)
          );
        }
      }

      return result;
    },
    async stop() {
      isStopped = true;
      // TODO: how to close db?
    },
  };
};
