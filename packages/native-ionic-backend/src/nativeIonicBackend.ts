import { SQLite, SQLiteObject } from "@awesome-cordova-plugins/sqlite";
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
          },
      transactionOpts?: ITransactionOpts
    ) => {
      if (!db) {
        throw new Error(`Failed to run queries, db not initialized`);
      }

      const totalStartedAt = getTime();

      const startBlockAt = getTime();
      const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
      const endBlockAt = getTime();
      const blockTime = endBlockAt - startBlockAt;

      const res: IExecQueriesResult["result"] = [];

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
      } catch (e) {
        if (transactionOpts?.rollbackOnFail) {
          try {
            await db.executeSql("ROLLBACK", []);
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
        result: res,
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

        db = await SQLite.create({
          name: path(dbName),
          location: "default",
        });

        if (isStopped) {
          await db.close();
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
      async stop() {
        isStopped = true;

        if (db) {
          await db.close();
        }
      },
    };
  };
};
