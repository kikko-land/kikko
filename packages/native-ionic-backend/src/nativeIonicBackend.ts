import { SQLite, SQLiteObject } from "@awesome-cordova-plugins/sqlite";
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

export const ionicBackend = (path: (dbName: string) => string): IDbBackend => {
  return ({ dbName }) => {
    let isStopped = true;
    let db: SQLiteObject | undefined = undefined;
    const jobsState = initJobsState();

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
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }

        const totalStartedAt = performance.now();

        const startBlockAt = performance.now();
        const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
        const endBlockAt = performance.now();
        const blockTime = endBlockAt - startBlockAt;

        const res: IExecQueriesResult["result"] = [];

        try {
          for (const q of queries) {
            const startTime = performance.now();
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

            const end = performance.now();

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

        const totalFinishedAt = performance.now();
        return {
          result: res,
          performance: {
            totalTime: totalFinishedAt - totalStartedAt,
            blockTime,
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
