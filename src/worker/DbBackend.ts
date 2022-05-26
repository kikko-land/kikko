import initSqlJs, {
  BindParams,
  Database,
  QueryExecResult,
} from "@harika-org/sql.js";
// @ts-ignore
import { SQLiteFS } from "absurd-sql";
import IndexedDBBackend from "absurd-sql/dist/indexeddb-backend";

const colors = ["yellow", "cyan", "magenta"];

export class DbBackend {
  private sqlDb!: Database;

  constructor(private dbName: string, private wasmUrl: string) {}

  async init() {
    let SQL = await initSqlJs({
      locateFile: () => this.wasmUrl,
    });

    let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());

    SQL.register_for_idb(sqlFS);
    SQL.FS.mkdir("/blocked");
    SQL.FS.mount(sqlFS, {}, "/blocked");

    const path = `/blocked/${this.dbName}.sqlite`;
    if (typeof SharedArrayBuffer === "undefined") {
      console.log("No SharedArrayBuffer");
      let stream = SQL.FS.open(path, "a+");
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
    }

    this.sqlDb = new SQL.Database(`/blocked/${this.dbName}.sqlite`, {
      filename: true,
    });

    this.sqlExec(`
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=${32 * 1024};
      PRAGMA cache_size=-${10 * 1024};
      PRAGMA foreign_keys=ON;
    `);
  }

  private currentTransactionI = 0;
  private currentTransactionId: string | undefined;
  sqlExec(
    sql: string,
    params?: BindParams,
    logOpts?: {
      transactionId?: string;
      suppressLog?: boolean;
    }
  ): QueryExecResult[] {
    try {
      const startTime = performance.now();
      const res = this.sqlDb.exec(sql, params);
      const end = performance.now();

      if (
        logOpts?.transactionId &&
        logOpts.transactionId !== this.currentTransactionId &&
        !logOpts.suppressLog
      ) {
        this.currentTransactionId = logOpts.transactionId;
        this.currentTransactionI++;
      }
      if (!logOpts?.transactionId) {
        this.currentTransactionId = undefined;
      }

      if (!logOpts?.suppressLog) {
        console.log(
          `%c[${this.dbName.substring(0, 10)}]${
            logOpts?.transactionId
              ? `[tr_id=${logOpts.transactionId.split("-")[0]}]`
              : ""
          } ${sql} ${JSON.stringify(params)} Time: ${(
            (end - startTime) /
            1000
          ).toFixed(4)}`,
          `color: ${
            this.currentTransactionId
              ? colors[this.currentTransactionI % colors.length]
              : "white"
          }`
        );
      }

      return res;
    } catch (e) {
      console.error(
        `[${this.dbName}] Failed execute`,
        e,
        sql,
        params,
        logOpts,
        this.currentTransactionId
      );
      throw e;
    }
  }
}
