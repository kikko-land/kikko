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

    const runQueries = async (
      queries:
        | { type: "usual"; values: IQuery[] }
        | {
            type: "prepared";
            query: IQuery;
            preparedValues: IPrimitiveValue[][];
          },
      trOpts?: ITransactionOpts
    ) => {
      if (!db) {
        throw new Error(`Failed to run queries, db not initialized`);
      }
      const totalStartedAt = getTime();

      const startBlockAt = getTime();
      const job = await acquireWithTrJobOrWait(jobsState, trOpts);
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

          const endTime = getTime();

          result.push({
            rows,
            performance: {
              execTime: endTime - startTime,
            },
          });
        }
      } catch (e) {
        if (trOpts?.rollbackOnFail) {
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

      const totalFinishedAt = getTime();

      return Promise.resolve({
        result,
        performance: {
          totalTime: totalFinishedAt - totalStartedAt,
          blockTime,
        },
      });
    };

    return {
      async initialize() {
        if (isStopped)
          throw new Error("Failed to start DB cause it is stopped");

        db = await window.sqliteDb(path(dbName));

        if (isStopped) {
          db.close();
        }
      },
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
      stop() {
        isStopped = true;

        if (db) {
          db.close();
        }

        return Promise.resolve();
      },
    };
  };
