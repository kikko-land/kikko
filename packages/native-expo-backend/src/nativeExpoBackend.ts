import { IDbBackend, IQuery, IQueryResult } from "@kikko-land/core";
import { openDatabase, ResultSet, ResultSetError } from "expo-sqlite";

export const nativeExpoBackend =
  (): IDbBackend =>
  ({ dbName, stopped$ }) => {
    const db = openDatabase(dbName + ".db");

    return {
      async initialize() {
        stopped$.subscribe(() => {
          void db.closeAsync();
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
      ): Promise<IQueryResult[]> {
        const startTime = performance.now();

        return new Promise<IQueryResult[]>((resolve, reject) => {
          db.exec(
            queries.map((q) => ({ sql: q.text, args: q.values })),
            false,
            (_, results) => {
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

              if (!results) {
                resolve([]);

                return;
              }

              const errors = (
                results.filter((res) => "error" in res) as ResultSetError[]
              ).map((er) => er.error);

              if (errors.length > 0) {
                reject(`Failed execute queries: ${errors.join(" ")}`);
                return;
              }

              const goodResults = results as ResultSet[];

              resolve(goodResults.map(({ rows }) => rows));
            }
          );
        });
      },
    };
  };
