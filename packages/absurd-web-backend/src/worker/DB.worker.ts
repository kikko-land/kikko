import { DbBackend } from "./DbBackend";
import { IInputWorkerMessage, IOutputWorkerMessage, IResponse } from "./types";

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as unknown as Worker;
let db: DbBackend | undefined;

ctx.addEventListener("message", (event) => {
  void (async () => {
    const postMessage = (m: IOutputWorkerMessage) => ctx.postMessage(m);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data: IInputWorkerMessage = event.data;

    if (data.type === "initialize") {
      if (db) {
        // TODO: send error response
        throw new Error("DB already initialized!");
      }

      db = new DbBackend(
        data.dbName,
        data.wasmUrl,
        data.pageSize,
        data.cacheSize
      );

      await db.init();

      postMessage({ type: "initialized" });
    } else {
      if (!db) {
        postMessage({
          type: "response",
          data: {
            commandId: data.data.commandId,
            status: "error",
            message: "DB not initialized!",
          },
        });

        console.error("DB is not initialized");

        return;
      }
      const sendTime = new Date().getTime() - data.sentAt;

      const currentDb = db;

      try {
        const queriesResult = data.data.queries.map((q) => {
          return currentDb.sqlExec(q.text, q.values);
        });

        const response: IResponse = {
          commandId: data.data.commandId,
          status: "success",
          result: queriesResult,
          performance: {
            sendTime,
          },
          sentAt: new Date().getTime(),
        };

        postMessage({
          type: "response",
          data: response,
        });
      } catch (e) {
        postMessage({
          type: "response",
          data: {
            commandId: data.data.commandId,
            status: "error",
            message: e instanceof Error ? e.message : JSON.stringify(e),
          } as IResponse,
        });
      }
    }
  })();
});
