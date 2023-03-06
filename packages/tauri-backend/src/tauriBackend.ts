import {
  buildAsyncQueryRunner,
  getTime,
  IDbBackend,
  initJobsState,
  IPrimitiveValue,
  IQuery,
  IQueryResult,
  IRunRes,
  ITransactionOpts,
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
          }
    ): Promise<IRunRes[]> => {
      if (!db) {
        throw new Error("Failed to run queries, db not initialized");
      }

      const result: IRunRes[] = [];

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
      // await db.execute("ROLLBACK", []);

      return result;
    };

    const queryRunner = buildAsyncQueryRunner({
      async execPrepared(query: IQuery, preparedValues: IPrimitiveValue[][]) {
        return await runQueries({ type: "prepared", query, preparedValues });
      },
      async execUsualBatch(queriesToRun: IQuery[]): Promise<IRunRes[]> {
        return await runQueries({ type: "usual", values: queriesToRun });
      },
      async rollback() {
        if (!db) throw new Error("db not present");

        await db?.execute("ROLLBACK", []);
      },
    });

    return {
      async initialize() {
        if (isStopped)
          throw new Error("Failed to start DB cause it is stopped");

        db = await SQLite.open(path(dbName));
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
      async stop() {
        isStopped = true;

        return Promise.resolve();
        // TODO: how to close db?
      },
    };
  };
