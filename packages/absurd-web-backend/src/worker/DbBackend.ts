import { SQLiteFS } from "@kikko-land/better-absurd-sql";
import IndexedDBBackend from "@kikko-land/better-absurd-sql/dist/indexeddb-backend";
import initSqlJs, { BindParams, Database } from "@kikko-land/sql.js";

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

  sqlExec(
    sql: string,
    params?: BindParams
  ): {
    rows: Record<string, number | string | Uint8Array | null>[];
    performance: {
      prepareTime: number;
      execTime: number;
      freeTime: number;
    };
  } {
    const rows = [];

    const startPrepareTime = performance.now();
    const stmt = this.sqlDb.prepare(sql, params);
    const finishPrepareTime = performance.now();

    const startExecTime = performance.now();
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    const finishExecTime = performance.now();

    const startFreeTime = performance.now();
    stmt.free();
    const finishFreeTime = performance.now();

    return {
      rows,
      performance: {
        prepareTime: finishPrepareTime - startPrepareTime,
        execTime: finishExecTime - startExecTime,
        freeTime: finishFreeTime - startFreeTime,
      },
    };
  }
}
