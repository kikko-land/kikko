import {
  acquireWithTrJobOrWait,
  getTime,
  IDbBackend,
  IExecQueriesResult,
  initJobsState,
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
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }
        const totalStartedAt = getTime();

        const startBlockAt = getTime();
        const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
        const endBlockAt = getTime();
        const blockTime = endBlockAt - startBlockAt;

        const result: IExecQueriesResult["result"] = [];

        try {
          for (const q of queries) {
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
      },
      async stop() {
        isStopped = true;

        return Promise.resolve();
        // TODO: how to close db?
      },
    };
  };
