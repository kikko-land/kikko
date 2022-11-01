import {
  acquireWithTrJobOrWait,
  IDbBackend,
  initJobsState,
  IQuery,
  IQueryResult,
  ITransactionOpts,
  releaseTrJobIfPossible,
} from "@kikko-land/kikko";
import {
  Location,
  openDatabase,
  SQLiteDatabase,
} from "react-native-sqlite-storage";

export const reactNativeBackend =
  (initOpts: {
    name: (dbName: string) => string;
    location?: Location;
  }): IDbBackend =>
  ({ dbName }) => {
    let isStopped = true;
    let db: SQLiteDatabase | undefined;
    const jobsState = initJobsState();

    return {
      async initialize() {
        if (isStopped)
          throw new Error("Failed to start DB cause it is stopped");

        db = await openDatabase({
          name: initOpts.name(dbName),
          location: initOpts.location,
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

        const result: {
          rows: IQueryResult;
          performance: {
            execTime: number;
          };
        }[] = [];

        try {
          for (const q of queries) {
            const startTime = performance.now();

            const rows = (
              await db.executeSql(q.text, q.values)
            )[0].rows.raw() as IQueryResult;

            const endTime = performance.now();

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
          result,
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
