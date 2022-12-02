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

      const result: {
        rows: IQueryResult;
        performance: {
          execTime: number;
        };
      }[] = [];

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

          const rows = (
            await db.executeSql(q.text, q.values)
          )[0].rows.raw() as IQueryResult;

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

        db = await openDatabase({
          name: initOpts.name(dbName),
          location: initOpts.location,
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
