import {
  IDbBackend,
  IExecQueriesResult,
  IQuery,
  IQueryResult,
} from "@kikko-land/kikko";
import SQLite from "tauri-plugin-sqlite-api";

export const tauriBackend =
  (path: (dbName: string) => string): IDbBackend =>
  ({ dbName }) => {
    let isStopped = true;
    let db: SQLite | undefined = undefined;

    return {
      async initialize() {
        if (isStopped)
          throw new Error("Failed to start DB cause it is stopped");

        db = await SQLite.open(path(dbName));
      },
      async execQueries(queries: IQuery[]): Promise<IExecQueriesResult> {
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }
        const totalStartedAt = performance.now();

        const result: IExecQueriesResult["result"] = [];

        for (const q of queries) {
          const startTime = performance.now();

          const rows = await db.select<IQueryResult>(q.text, q.values);

          const endTime = performance.now();

          result.push({
            rows,
            performance: {
              execTime: endTime - startTime,
            },
          });
        }

        const totalFinishedAt = performance.now();

        return {
          result,
          performance: {
            totalTime: totalFinishedAt - totalStartedAt,
          },
        };
      },
      async stop() {
        isStopped = true;

        return Promise.resolve();
        // TODO: how to close db?
      },
    };
  };
