import { IDbBackend, IQuery, IQueryResult } from "@kikko-land/kikko";
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
      async execQueries(queries: IQuery[]) {
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }

        const totalStartedAt = performance.now();

        const result: {
          rows: IQueryResult;
          performance: {
            execTime: number;
          };
        }[] = [];

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

        const totalFinishedAt = performance.now();

        return {
          result,
          performance: {
            totalTime: totalFinishedAt - totalStartedAt,
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
