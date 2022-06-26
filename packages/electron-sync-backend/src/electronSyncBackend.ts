import { IDbBackend, IQuery, IQueryResult } from "@trong-orm/core";
import type sqlite3 from "sqlite3";

declare global {
  interface Window {
    sqliteDb: typeof sqlite3;
  }
}

export const electronSyncBackend =
  (path: (dbName: string) => string): IDbBackend =>
  ({ dbName, stopped$ }) => {
    const db = new window.sqliteDb.Database(path(dbName));

    db.serialize();

    return {
      async initialize() {
        stopped$.subscribe(() => {
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
        const result: IQueryResult[][] = [];

        for (const q of queries) {
          result.push(
            await new Promise<IQueryResult[]>((resolve, reject) => {
              const startTime = performance.now();

              db.all(q.text, q.values, function (err, rows) {
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
