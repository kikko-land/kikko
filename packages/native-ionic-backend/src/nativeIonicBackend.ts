import { SQLite, SQLiteObject } from "@awesome-cordova-plugins/sqlite";
import {
  IDbBackend,
  IExecQueriesResult,
  IQuery,
  IQueryResult,
} from "@kikko-land/kikko";

export const ionicBackend = (path: (dbName: string) => string): IDbBackend => {
  return ({ dbName }) => {
    let isStopped = true;
    let db: SQLiteObject | undefined = undefined;

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

      async execQueries(queries: IQuery[]) {
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }

        const totalStartedAt = performance.now();

        const res: IExecQueriesResult["result"] = [];

        for (const q of queries) {
          const startTime = performance.now();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const execResult = await db.executeSql(q.text, q.values);

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

        const totalFinishedAt = performance.now();
        return {
          result: res,
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
};
