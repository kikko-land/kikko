import { initBackend } from "@kikko-land/better-absurd-sql/dist/indexeddb-main-thread";
import { IDbBackend, IQuery, reactiveVar } from "@kikko-land/kikko";

import { buildRunQueriesCommand } from "./commands";
import { runWorkerCommand } from "./runWorkerCommand";
import { IBackendState } from "./types";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import DbWorker from "./worker/DB.worker?worker&inline";
import { IInputWorkerMessage, IOutputWorkerMessage } from "./worker/types";

export const absurdWebBackend = ({
  wasmUrl,
  queryTimeout,
  pageSize,
  cacheSize,
}: {
  wasmUrl: string | (() => Promise<string>);

  queryTimeout?: number;
  pageSize?: number;
  cacheSize?: number;
}): IDbBackend => ({ dbName }: { dbName: string }) => {
  const outcomingMessagesQueue = reactiveVar<IInputWorkerMessage[]>([]);
  const incomingMessagesQueue = reactiveVar<IOutputWorkerMessage[]>([]);
  const initializedWorker = new DbWorker();
  const isTerminated = reactiveVar(false);

  const unsubscribeOutcoming = outcomingMessagesQueue.subscribe((newVals) => {
    if (newVals.length === 0) return;
    outcomingMessagesQueue.value = [];

    for (const val of newVals) {
      initializedWorker.postMessage(val);
    }
  });

  const sub = (ev: MessageEvent<IOutputWorkerMessage>) => {
    // console.log(
    //   `[DB][${
    //     ev.data.type === 'response' && ev.data.data.commandId
    //   }] new message from worker`,
    //   ev.data,
    // );
    incomingMessagesQueue.value = [...incomingMessagesQueue.value, ev.data];
  };
  initializedWorker.addEventListener("message", sub);

  const unsubscribeIncoming = () => {
    initializedWorker.removeEventListener("message", sub);
  };

  const state: IBackendState = {
    outcomingMessagesQueue,
    incomingMessagesQueue,
    queryTimeout: queryTimeout || 30_000,
    isTerminated: isTerminated,
  };

  return {
    async initialize() {
      if (isTerminated.value) throw new Error("Db backend is terminated");

      initBackend(initializedWorker);

      const initPromise = incomingMessagesQueue.waitTill(
        (evs) => evs.some((ev) => ev.type === "initialized"),
        { stopIf: isTerminated }
      );

      const url = typeof wasmUrl === "string" ? wasmUrl : await wasmUrl();

      outcomingMessagesQueue.value = [
        ...outcomingMessagesQueue.value,
        {
          type: "initialize",
          dbName: dbName,
          wasmUrl: new URL(url, document.baseURI).toString(),
          pageSize: pageSize !== undefined ? pageSize : 32 * 1024,
          cacheSize: cacheSize !== undefined ? cacheSize : -5000,
        },
      ];

      await initPromise;
    },
    async execQueries(queries: IQuery[], opts) {
      return await runWorkerCommand(
        state,
        buildRunQueriesCommand(queries, opts)
      );
    },
    async stop() {
      isTerminated.value = true;

      unsubscribeOutcoming();
      unsubscribeIncoming();
      initializedWorker.terminate();
    },
  };
};
