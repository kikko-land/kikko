import { SQLite, SQLiteObject } from "@awesome-cordova-plugins/sqlite";
import { IDbBackend, IQuery, IQueryResult } from "@kikko-land/kikko";

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

      async execQueries(
        queries: IQuery[],
        opts: {
          log: {
            suppress: boolean;
            transactionId?: string;
          };
        }
      ) {
        if (!db) {
          throw new Error(
            `Failed to run queries: ${queries
              .map((q) => q.text)
              .join(" ")}, db not initialized`
          );
        }

        const res: IQueryResult[] = [];

        for (const q of queries) {
          const startTime = performance.now();
          const execResult = await db.executeSql(q.text, q.values);

          const rows: IQueryResult = new Array(execResult.rows.length);

          for (let i = 0; i < execResult.rows.length; i++) {
            rows[i] = execResult.rows.item(i);
          }

          const end = performance.now();

          if (!opts.log.suppress) {
            console.info(
              `[${dbName}]${
                opts.log.transactionId
                  ? `[tr_id=${opts.log.transactionId.slice(0, 6)}]`
                  : ""
              } ` +
                queries.map((q) => q.text).join(" ") +
                " Time: " +
                ((end - startTime) / 1000).toFixed(4)
            );
          }

          res.push(rows);
        }

        return res;
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
