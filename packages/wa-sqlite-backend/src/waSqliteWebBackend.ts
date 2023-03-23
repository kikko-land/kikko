import {
  buildAsyncQueryRunner,
  IDbBackend,
  IExecQueriesResult,
  initJobsState,
  IPrimitiveValue,
  IQuery,
  IQueryResult,
  IQueryValue,
  ITransactionOpts,
} from "@kikko-land/kikko";
import * as SQLite from "wa-sqlite";
import SQLiteAsyncModule from "wa-sqlite/dist/wa-sqlite-async.mjs";

import { IDBBatchAtomicVFS } from "./IDBBatchAtomicVFS";

export const waSqliteWebBackend =
  ({
    wasmUrl,
    pageSize,
    cacheSize,
  }: {
    wasmUrl: string;
    pageSize?: number;
    cacheSize?: number;
  }): IDbBackend =>
  ({ dbName }) => {
    let sqlite3: SQLiteAPI | undefined;
    let db: number | undefined;

    const jobsState = initJobsState();

    const runner = buildAsyncQueryRunner({
      execUsual: async (q: IQuery) => {
        if (!sqlite3 || db === undefined) {
          throw new Error("DB is not initialized");
        }

        const rows: IQueryResult = [];

        const startTime = Date.now();

        const str = sqlite3.str_new(db, q.text);
        const prepare = await sqlite3.prepare_v2(db, sqlite3.str_value(str));

        if (!prepare) {
          throw new Error(`Failed to prepare ${q.text} query`);
        }

        sqlite3.bind_collection(
          prepare.stmt,
          q.values as SQLiteCompatibleType[]
        );

        const columns = sqlite3.column_names(prepare.stmt);

        while ((await sqlite3.step(prepare.stmt)) === SQLite.SQLITE_ROW) {
          if (columns.length > 0) {
            rows.push(
              Object.fromEntries(
                sqlite3
                  .row(prepare.stmt)
                  .map((val, i) => [columns[i], val as IQueryValue])
              )
            );
          }
        }
        sqlite3.str_finish(str);
        await sqlite3.finalize(prepare.stmt);

        const endTime = Date.now();

        return {
          rows,
          performance: {
            execTime: endTime - startTime,
          },
        };
      },
      async execPrepared(q: IQuery, preparedValues: IPrimitiveValue[][]) {
        if (!sqlite3 || db === undefined) {
          throw new Error("DB is not initialized");
        }

        const result: IExecQueriesResult["result"] = [];

        const startTime = Date.now();

        const startPreparedAt = Date.now();
        const str = sqlite3.str_new(db, q.text);
        const prepare = await sqlite3.prepare_v2(db, sqlite3.str_value(str));
        const finishPrepareTime = Date.now();

        if (!prepare) {
          throw new Error(`Failed to prepare ${q.text} query`);
        }

        const columns = sqlite3.column_names(prepare.stmt);

        for (const values of preparedValues) {
          await sqlite3.reset(prepare.stmt);

          sqlite3.bind_collection(
            prepare.stmt,
            values as SQLiteCompatibleType[]
          );

          const rows: IQueryResult = [];

          while ((await sqlite3.step(prepare.stmt)) === SQLite.SQLITE_ROW) {
            if (columns.length > 0) {
              rows.push(
                Object.fromEntries(
                  sqlite3
                    .row(prepare.stmt)
                    .map((val, i) => [columns[i], val as IQueryValue])
                )
              );
            }
          }

          result.push({
            rows: rows,
            performance: {
              execTime: 0,
            },
          });
        }

        sqlite3.str_finish(str);
        await sqlite3.finalize(prepare.stmt);

        const endTime = Date.now();

        if (result[0]) {
          result[0].performance.execTime = endTime - startTime;
          result[0].performance.prepareTime =
            finishPrepareTime - startPreparedAt;
        }

        return result;
      },
      async rollback() {
        if (!sqlite3 || db === undefined) {
          throw new Error("DB is not initialized");
        }

        await sqlite3.exec(db, "ROLLBACK");
      },
    });

    return {
      async initialize() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const module = await SQLiteAsyncModule({ locateFile: () => wasmUrl });

        sqlite3 = SQLite.Factory(module);

        const klass = IDBBatchAtomicVFS;

        sqlite3.vfs_register(
          new klass(`idb-batch`, {
            purge: "manual",
            durability: "relaxed",
          })
        );

        db = await sqlite3.open_v2(
          "wa-sqlite-" + dbName,
          undefined,
          `idb-batch`
        );

        await sqlite3.exec(
          db,
          `PRAGMA cache_size=${cacheSize === undefined ? 5000 : cacheSize};`
        );
        await sqlite3.exec(
          db,
          `PRAGMA page_size=${pageSize === undefined ? 32 * 1024 : pageSize};`
        );
        await sqlite3.exec(db, `PRAGMA journal_mode=MEMORY;`);
        await sqlite3.exec(db, `PRAGMA temp_store=MEMORY;`);
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
        const startedAt = Date.now();

        const res = await runner.run(jobsState, q, transactionOpts);
        const endAt = Date.now();

        return {
          result: res.result,
          performance: {
            ...res.performance,
            totalTime: endAt - startedAt,
          },
        };
      },
      async stop() {
        if (sqlite3 && db !== undefined) {
          await sqlite3.close(db);
        }

        sqlite3 = undefined;
        db = undefined;
      },
    };
  };
