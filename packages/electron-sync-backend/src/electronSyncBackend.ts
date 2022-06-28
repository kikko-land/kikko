import { IDbBackend, IQuery, IQueryResult } from "@trong-orm/core";
import type { Statement } from "sqlite3";

declare global {
  interface Window {
    sqliteDb: (path: string) => Promise<{
      serialize: (callback?: () => void) => void;
      close: (callback?: (err: Error | null) => void) => void;
      all: (
        sql: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback?: (this: Statement, err: Error | null, rows: any[]) => void
      ) => void;
    }>;
  }
}

export type ValueType<T> = T extends Promise<infer U> ? U : T;
export const electronSyncBackend =
  (path: (dbName: string) => string): IDbBackend =>
  ({ dbName, stopped$ }) => {
    let db: ValueType<ReturnType<typeof window.sqliteDb>> | undefined =
      undefined;

    return {
      async initialize() {
        db = await window.sqliteDb(path(dbName));

        stopped$.subscribe(() => {
          if (!db) {
            console.error("Failed to stop DB — it is not initialized");

            return;
          }
          db.close();
        });
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
              .join(" ")} — db not initialized`
          );
        }

        const currentDb = db;

        const result: IQueryResult[] = [];

        for (const q of queries) {
          result.push(
            await new Promise<IQueryResult>((resolve, reject) => {
              const startTime = performance.now();

              currentDb.all(q.text, q.values, function (err, rows) {
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

                if (err) {
                  reject(`Failed to execute query: ${q.text}`);
                }

                resolve(rows);
              });
            })
          );
        }

        return result;
      },
    };
  };
