import {
  acquireWithTrJobOrWait,
  IDbBackend,
  IExecQueriesResult,
  initJobsState,
  IQuery,
  ITransactionOpts,
  releaseTrJobIfPossible,
} from "@kikko-land/kikko";
import { openDatabase, ResultSet, ResultSetError } from "expo-sqlite";

export const nativeExpoBackend =
  (): IDbBackend =>
  ({ dbName }) => {
    const jobsState = initJobsState();
    const db = openDatabase(dbName + ".db");

    return {
      async initialize() {},
      async execQueries(queries: IQuery[], transactionOpts?: ITransactionOpts) {
        const startTime = performance.now();

        const startBlockAt = performance.now();
        const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
        const endBlockAt = performance.now();
        const blockTime = endBlockAt - startBlockAt;

        try {
          return await new Promise<IExecQueriesResult>((resolve, reject) => {
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
                  performance: { totalTime: end - startTime, blockTime },
                });
              }
            );
          });
        } catch (e) {
          if (transactionOpts?.rollbackOnFail) {
            try {
              await new Promise<void>((resolve) => {
                db.exec([{ sql: "ROLLBACK", args: [] }], false, (_) => {
                  resolve();
                });
              });
            } catch (rollbackError) {
              console.error(`Failed to rollback`, e, rollbackError);
            }
          }

          throw e;
        } finally {
          releaseTrJobIfPossible(jobsState, job, transactionOpts);
        }
      },
      async stop() {
        if (db) {
          db.closeAsync();
        }

        return Promise.resolve();
      },
    };
  };
