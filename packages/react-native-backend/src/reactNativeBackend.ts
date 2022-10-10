import { IDbBackend, IQuery, IQueryResult } from "@kikko-land/kikko";
import {
  Location,
  openDatabase,
  SQLiteDatabase,
} from "react-native-sqlite-storage";

export const reactNativeBackend = (initOpts: {
  name: (dbName: string) => string;
  location?: Location;
}): IDbBackend => ({ dbName }) => {
  let isStopped = true;
  let db: SQLiteDatabase | undefined;

  return {
    async initialize() {
      if (isStopped) throw new Error("Failed to start DB cause it is stopped");

      db = await openDatabase({
        name: initOpts.name(dbName),
        location: initOpts.location,
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
    ): Promise<IQueryResult[]> {
      if (!db) {
        throw new Error(
          `Failed to run queries: ${queries
            .map((q) => q.text)
            .join(" ")}, db not initialized`
        );
      }

      const result: IQueryResult[] = [];

      for (const q of queries) {
        const startTime = new Date().getTime();

        result.push(
          (await db.executeSql(q.text, q.values))[0].rows.raw() as IQueryResult
        );

        const end = new Date().getTime();

        if (!opts.log.suppress) {
          console.info(
            `[${dbName}]${
              opts.log.transactionId
                ? `[tr_id=${opts.log.transactionId.slice(0, 6)}]`
                : ""
            } ` +
              queries.map((it) => it.text).join(" ") +
              " Time: " +
              ((end - startTime) / 1000).toFixed(4)
          );
        }
      }

      return result;
    },
    async stop() {
      isStopped = true;

      if (db) {
        await db.close();
      }
    },
  };
};
