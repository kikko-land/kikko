export const initSqliteBridge = async () => {
  const { default: Database } = await import("better-sqlite3");
  const { contextBridge } = await import("electron");

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
