import {
  acquireWithTrJobOrWait,
  getTime,
  IDbBackend,
  IExecQueriesResult,
  initJobsState,
  IPrimitiveValue,
  IQuery,
  IQueryResult,
  ITransactionOpts,
  releaseTrJobIfPossible,
} from "@kikko-land/kikko";
import SQLite from "tauri-plugin-sqlite-api";

export const tauriBackend =
  (path: (dbName: string) => string): IDbBackend =>
  ({ dbName }) => {
    let isStopped = true;
    let db: SQLite | undefined = undefined;
    const jobsState = initJobsState();

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
      if (!db) {
        throw new Error("Failed to run queries, db not initialized");
      }
      const totalStartedAt = getTime();

      const startBlockAt = getTime();
      const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
      const endBlockAt = getTime();
      const blockTime = endBlockAt - startBlockAt;

      const result: IExecQueriesResult["result"] = [];

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
        for (const q of queriesToRun) {
          const startTime = getTime();

          const rows = await db.select<IQueryResult>(q.text, q.values);

          const endTime = getTime();

          result.push({
            rows,
            performance: {
              execTime: endTime - startTime,
            },
          });
        }
      } catch (e) {
        if (transactionOpts?.rollbackOnFail) {
          try {
            await db.execute("ROLLBACK", []);
          } catch (rollbackError) {
            console.error(`Failed to rollback`, e, rollbackError);
          }
        }

        throw e;
      } finally {
        releaseTrJobIfPossible(jobsState, job, transactionOpts);
      }

      const totalFinishedAt = getTime();

      return {
        result,
        performance: {
          totalTime: totalFinishedAt - totalStartedAt,
          blockTime,
        },
      };
    };

    return {
      async initialize() {
        if (isStopped)
          throw new Error("Failed to start DB cause it is stopped");

        db = await SQLite.open(path(dbName));
      },
      async execQueries(
        queries: IQuery[],
        transactionOpts?: ITransactionOpts
      ): Promise<IExecQueriesResult> {
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
        isStopped = true;

        return Promise.resolve();
        // TODO: how to close db?
      },
    };
  };
