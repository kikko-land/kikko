import {
  buildSyncQueryRunner,
  getTime,
  IDbBackend,
  initJobsState,
  IPrimitiveValue,
  IQuery,
  IQueryResult,
  IRunRes,
  ITransactionOpts,
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

    const queryRunner = buildSyncQueryRunner({
      execPrepared(query: IQuery, preparedValues: IPrimitiveValue[][]) {
        if (!db) {
          throw new Error(`Failed to run queries, db not initialized`);
        }

        const result: IRunRes[] = [];
        for (const v of preparedValues) {
          const startTime = getTime();

          const rows = (() => {
            try {
              return db.all(query.text, v) as IQueryResult;
            } catch (e) {
              if (e instanceof Error) {
                e.message = `Error while executing query: ${query.text} - ${e.message}`;
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

        return result;
      },
      execUsual(queriesToRun: IQuery): IRunRes {
        if (!db) {
          throw new Error(`Failed to run queries, db not initialized`);
        }

        return {
          rows: db.all(
            queriesToRun.text,
            queriesToRun.values
          ) as IRunRes["rows"],
          performance: {},
        };
      },
      rollback() {
        if (!db) {
          throw new Error(`Failed to run queries, db not initialized`);
        }
        db.all("ROLLBACK", []);
      },
    });

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
        q:
          | { type: "usual"; values: IQuery[] }
          | {
              type: "prepared";
              query: IQuery;
              preparedValues: IPrimitiveValue[][];
            },
        transactionOpts?: ITransactionOpts
      ) {
        const startedAt = getTime();
        const res = await queryRunner.run(jobsState, q, transactionOpts);
        const endAt = getTime();

        return {
          ...res,
          performance: {
            ...res.performance,
            totalTime: endAt - startedAt,
          },
        };
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
