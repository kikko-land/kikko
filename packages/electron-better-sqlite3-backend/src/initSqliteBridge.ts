import { Database } from "better-sqlite3";
import { contextBridge } from "electron";

export const initSqliteBridge = async () => {
  contextBridge.exposeInMainWorld("sqliteDb", async (file: string) => {
    const db = new Database(file);

    return {
      close: () => {
        db.close();
      },
      all: function (sql: string, params: (null | number | string | Buffer)[]) {
        const stmt = db.prepare(sql);

        if (stmt.reader) {
          return stmt.all(params);
        } else {
          stmt.run(params);

          return [];
        }
      },
    };
  });
};
