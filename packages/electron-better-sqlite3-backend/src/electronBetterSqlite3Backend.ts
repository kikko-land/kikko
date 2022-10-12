import { IDbBackend, IQuery, IQueryResult } from "@kikko-land/kikko";

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
      execQueries(
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

          result.push(db.all(q.text, q.values) as IQueryResult);

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

        return Promise.resolve(result);
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
