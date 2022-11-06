import {
  acquireWithTrJobOrWait,
  IDbBackend,
  IExecQueriesResult,
  initJobsState,
  IQuery,
  IQueryResult,
  ITransactionOpts,
  releaseTrJobIfPossible,
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
    const jobsState = initJobsState();

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
      async execQueries(
        queries: IQuery[],
        trOpts: ITransactionOpts
      ): Promise<IExecQueriesResult> {
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }
        const totalStartedAt = performance.now();

        const startBlockAt = performance.now();
        const job = await acquireWithTrJobOrWait(jobsState, trOpts);
        const endBlockAt = performance.now();
        const blockTime = endBlockAt - startBlockAt;

        const result: IExecQueriesResult["result"] = [];

        try {
          for (const q of queries) {
            const startTime = performance.now();

            const rows = (() => {
              try {
                return db.all(q.text, q.values) as IQueryResult;
              } catch (e) {
                if (e instanceof Error) {
                  e.message = `Error while executing query: ${q.text} - ${e.message}`;
                }
                throw e;
              }
            })();

            const endTime = performance.now();

            result.push({
              rows,
              performance: {
                execTime: endTime - startTime,
              },
            });
          }
        } catch (e) {
          if (trOpts.rollbackOnFail) {
            try {
              db.all("ROLLBACK", []);
            } catch (rollbackError) {
              console.error(`Failed to rollback`, e, rollbackError);
            }
          }

          throw e;
        } finally {
          releaseTrJobIfPossible(jobsState, job, trOpts);
        }

        const totalFinishedAt = performance.now();

        return Promise.resolve({
          result,
          performance: {
            totalTime: totalFinishedAt - totalStartedAt,
            blockTime,
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
