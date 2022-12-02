import {
  acquireWithTrJobOrWait,
  getTime,
  IDbBackend,
  IExecQueriesResult,
  initJobsState,
  IPrimitiveValue,
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
    const runQueries = async (
      queries:
        | { type: "usual"; values: IQuery[] }
        | {
            type: "prepared";
            query: IQuery;
            preparedValues: IPrimitiveValue[][];
          },
      transactionOpts?: ITransactionOpts
    ) => {
      const startTime = getTime();

      const startBlockAt = getTime();
      const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
      const endBlockAt = getTime();
      const blockTime = endBlockAt - startBlockAt;

      try {
        const queriesToRun =
          queries.type === "usual"
            ? queries.values
            : queries.preparedValues.map(
                (v): IQuery => ({
                  text: queries.query.text,
                  values: v,
                })
              );
        return await new Promise<IExecQueriesResult>((resolve, reject) => {
          db.exec(
            queriesToRun.map((q) => ({ sql: q.text, args: q.values })),
            false,
            (_, results) => {
              const end = getTime();

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
    };

    return {
      async initialize() {},
      async execQueries(queries: IQuery[], transactionOpts?: ITransactionOpts) {
        return runQueries({ type: "usual", values: queries }, transactionOpts);
      },
      async execPreparedQuery(
        query: IQuery,
        preparedValues: IPrimitiveValue[][],
        transactionOpts?: ITransactionOpts
      ): Promise<IExecQueriesResult> {
        return runQueries(
          { type: "prepared", query, preparedValues },
          transactionOpts
        );
      },
      async stop() {
        if (db) {
          db.closeAsync();
        }

        return Promise.resolve();
      },
    };
  };
