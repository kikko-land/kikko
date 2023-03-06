import { SQLiteFS } from "@kikko-land/better-absurd-sql";
import IndexedDBBackend from "@kikko-land/better-absurd-sql/dist/indexeddb-backend";
import { getTime } from "@kikko-land/kikko";
import initSqlJs, { BindParams, Database } from "@kikko-land/sql.js";

type IRes = {
  rows: Record<string, number | string | Uint8Array | null>[];
  performance: {
    prepareTime: number;
    execTime: number;
  };
};

export class DbBackend {
  private sqlDb!: Database;

  constructor(
    private dbName: string,
    private wasmUrl: string,
    private pageSize: number,
    private cacheSize: number
  ) {}

  async init() {
    const SQL = await initSqlJs({
      locateFile: () => this.wasmUrl,
    });

    const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());

    SQL.register_for_idb(sqlFS);
    SQL.FS.mkdir("/blocked");
    SQL.FS.mount(sqlFS, {}, "/blocked");

    const path = `/blocked/${this.dbName}.sqlite`;

    if (typeof SharedArrayBuffer === "undefined") {
      console.log("No SharedArrayBuffer");
      const stream = SQL.FS.open(path, "a+");
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
    }

    this.sqlDb = new SQL.Database(`/blocked/${this.dbName}.sqlite`, {
      filename: true,
    });

    console.log("Setting pragma");

    this.sqlDb.exec(`
      PRAGMA cache_size=${this.cacheSize};
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=${this.pageSize};
    `);
  }

  sqlExec(sql: string, params?: BindParams): IRes {
    const rows = [];

    const startPrepareTime = getTime();
    const stmt = this.sqlDb.prepare(sql, params);
    const finishPrepareTime = getTime();

    const startExecTime = getTime();
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    const finishExecTime = getTime();

    stmt.free();

    return {
      rows,
      performance: {
        prepareTime: finishPrepareTime - startPrepareTime,
        execTime: finishExecTime - startExecTime,
      },
    };
  }

  execPrepared(sql: string, params: BindParams[]): IRes[] {
    const res: IRes[] = [];

    const startPrepareTime = getTime();
    const stmt = this.sqlDb.prepare(sql);
    const finishPrepareTime = getTime();

    for (const param of params) {
      const arr: Record<string, number | string | Uint8Array | null>[] = [];
      const startExecTime = getTime();
      stmt.bind(param);
      while (stmt.step()) {
        arr.push(stmt.getAsObject());
      }
      const finishExecTime = getTime();
      res.push({
        rows: arr,
        performance: {
          prepareTime: finishPrepareTime - startPrepareTime,
          execTime: finishExecTime - startExecTime,
        },
      });
      stmt.reset();
    }

    if (res[0]) {
      res[0].performance.prepareTime = finishPrepareTime - startPrepareTime;
    }

    stmt.free();

    return res;
  }
}
