// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const initSqliteBridge = async () => {
  const Database = (await import("better-sqlite3")).default;
  const { contextBridge } = await import("electron");

  contextBridge.exposeInMainWorld("sqliteDb", (file: string) => {
    const db = new Database(file);

    return {
      close: () => {
        db.close();
      },
      all: function (sql: string, params: (null | number | string | Buffer)[]) {
        const stmt = db.prepare(sql);

        if (stmt.reader) {
          return stmt.all(params) as unknown[];
        } else {
          stmt.run(params);

          return [];
        }
      },
    };
  });
};

initSqliteBridge();
