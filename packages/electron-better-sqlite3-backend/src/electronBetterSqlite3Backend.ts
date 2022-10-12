import {
  IDbBackend,
  IExecQueriesResult,
  IQuery,
  IQueryResult,
} from "@kikko-land/kikko";

declare global {
  interface Window {
    sqliteDb: (path: string) => Promise<{
      close: (callback?: (err: Error | null) => void) => void;
      all: (
        sql: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params: any
      ) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unknown[];
    }>;
  }
}

export type ValueType<T> = T extends Promise<infer U> ? U : T;
export const electronBetterSqlite3Backend =
  (path: (dbName: string) => string): IDbBackend =>
  ({ dbName }) => {
    let isStopped = true;
    let db: ValueType<ReturnType<typeof window.sqliteDb>> | undefined =
      undefined;

    return {
      async initialize() {
        if (isStopped)
          throw new Error("Failed to start DB cause it is stopped");

        db = await window.sqliteDb(path(dbName));

        if (isStopped) {
          db.close();
        }
      },
      execQueries(queries: IQuery[]): Promise<IExecQueriesResult> {
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

          const rows = db.all(q.text, q.values) as IQueryResult;

          const endTime = performance.now();

          result.push({
            rows,
            performance: {
              execTime: endTime - startTime,
            },
          });
        }

        const totalFinishedAt = performance.now();

        return Promise.resolve({
          result,
          performance: {
            totalTime: totalFinishedAt - totalStartedAt,
          },
        });
      },
      stop() {
        isStopped = true;

        if (db) {
          db.close();
        }

        return Promise.resolve();
      },
    };
  };
