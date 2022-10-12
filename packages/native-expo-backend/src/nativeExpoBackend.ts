import { IDbBackend, IExecQueriesResult, IQuery } from "@kikko-land/kikko";
import { openDatabase, ResultSet, ResultSetError } from "expo-sqlite";

export const nativeExpoBackend =
  (): IDbBackend =>
  ({ dbName }) => {
    const db = openDatabase(dbName + ".db");

    return {
      async initialize() {},
      async execQueries(queries: IQuery[]) {
        const startTime = performance.now();

        return new Promise<IExecQueriesResult>((resolve, reject) => {
          db.exec(
            queries.map((q) => ({ sql: q.text, args: q.values })),
            false,
            (_, results) => {
              const end = performance.now();

              if (!results) {
                resolve({
                  result: [],
                  performance: { totalTime: end - startTime },
                });

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

              resolve({
                result: goodResults.map(({ rows }) => ({
                  rows,
                  performance: {},
                })),
                performance: { totalTime: end - startTime },
              });
            }
          );
        });
      },
      async stop() {
        if (db) {
          db.closeAsync();
        }

        return Promise.resolve();
      },
    };
  };
