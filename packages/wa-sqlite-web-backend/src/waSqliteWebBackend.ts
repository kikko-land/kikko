import { IDbBackend, IQuery, IQueryResult, IQueryValue } from "@trong-orm/core";
import * as SQLite from "wa-sqlite";
import SQLiteAsyncModule from "wa-sqlite/dist/wa-sqlite-async.mjs";

import { IDBAtomicVFS } from "./IDBAtomicVFS";
import { IDBBatchAtomicVFS } from "./IDBBatchAtomicVFS";
import { IDBMinimalVFS } from "./IDBMinimalVFS";

export const waSqliteWebBackend =
  ({
    wasmUrl,
    pageSize,
    cacheSize,
    vfs: _vfs,
  }: {
    wasmUrl: string;
    pageSize?: number;
    cacheSize?: number;
    vfs?: "atomic" | "batch-atomic" | "minimal";
  }): IDbBackend =>
  ({ dbName, stopped$ }) => {
    let sqlite3: SQLiteAPI | undefined;
    let db: number | undefined;

    const vfs = _vfs ? _vfs : "minimal";

    return {
      async initialize() {
        const module = await SQLiteAsyncModule({ locateFile: () => wasmUrl });

        sqlite3 = SQLite.Factory(module);

        const klass =
          vfs === "atomic"
            ? IDBAtomicVFS
            : vfs === "minimal"
            ? IDBMinimalVFS
            : IDBBatchAtomicVFS;

        sqlite3.vfs_register(
          new klass(`idb-${vfs}-relaxed`, {
            purge: "manual",
            durability: "relaxed",
          })
        );

        db = await sqlite3.open_v2(
          "wa-sqlite-" + dbName,
          undefined,
          `idb-${vfs}-relaxed`
        );

        await sqlite3.exec(
          db,
          `PRAGMA cache_size=${cacheSize === undefined ? -5000 : cacheSize};`
        );
        await sqlite3.exec(
          db,
          `PRAGMA page_size=${pageSize === undefined ? 32 * 1024 : pageSize};`
        );
        await sqlite3.exec(db, `PRAGMA journal_mode=MEMORY;`);

        // TODO: race condition on close may happen
        stopped$.subscribe(() => {
          if (sqlite3 && db !== undefined) {
            void sqlite3.close(db);
          }
        });
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
        if (!sqlite3 || db === undefined) {
          throw new Error("DB is not initialized");
        }

        const allResults: IQueryResult[] = [];

        for (const q of queries) {
          const rows: IQueryResult = [];

          const startTime = performance.now();

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

          allResults.push(rows);

          const end = performance.now();

          if (!opts.log.suppress) {
            console.info(
              `[${dbName}]${
                opts.log.transactionId
                  ? `[tr_id=${opts.log.transactionId.slice(0, 6)}]`
                  : ""
              } ` +
                q.text +
                " Time: " +
                ((end - startTime) / 1000).toFixed(4)
            );
          }
        }

        return allResults;
      },
    };
  };
