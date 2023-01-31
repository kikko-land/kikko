import { SQLite, SQLiteObject } from "@awesome-cordova-plugins/sqlite";
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

export const ionicBackend = (path: (dbName: string) => string): IDbBackend => {
  return ({ dbName }) => {
    let isStopped = true;
    let db: SQLiteObject | undefined = undefined;
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
        throw new Error(`Failed to run queries, db not initialized`);
      }

      const res: IRunRes[] = [];

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const execResult = await (async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await db.executeSql(q.text, q.values);
          } catch (e) {
            if (e instanceof Error) {
              e.message = `Error while executing query: ${q.text} - ${e.message}`;
            }
            throw e;
          }
        })();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const rows: IQueryResult = new Array(execResult.rows.length);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        for (let i = 0; i < execResult.rows.length; i++) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          rows[i] = execResult.rows.item(i);
        }

        const end = getTime();

        res.push({
          rows: rows,
          performance: {
            execTime: end - startTime,
          },
        });
      }

      return res;
    };

    const queryRunner = buildAsyncQueryRunner({
      async execPrepared(query: IQuery, preparedValues: IPrimitiveValue[][]) {
        return await runQueries({ type: "prepared", query, preparedValues });
      },
      async execUsualBatch(queriesToRun: IQuery[]): Promise<IRunRes[]> {
        return await runQueries({ type: "usual", values: queriesToRun });
      },
      async rollback() {
        if (!db) {
          throw new Error(`Failed to run queries, db not initialized`);
        }
        await db.executeSql("ROLLBACK");
      },
    });

    return {
      async initialize() {
        if (isStopped)
          throw new Error("Failed to start DB cause it is stopped");

        db = await SQLite.create({
          name: path(dbName),
          location: "default",
        });

        if (isStopped) {
          await db.close();
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
      async stop() {
        isStopped = true;

        if (db) {
          await db.close();
        }
      },
    };
  };
};
