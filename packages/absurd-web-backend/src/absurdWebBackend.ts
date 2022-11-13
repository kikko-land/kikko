import { initBackend } from "@kikko-land/better-absurd-sql/dist/indexeddb-main-thread";
import {
  getTime,
  IDbBackend,
  IQuery,
  ITransactionOpts,
  reactiveVar,
} from "@kikko-land/kikko";
import * as Comlink from "comlink";

import type { DbWorker } from "./worker/DB.worker";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import RawWorker from "./worker/DB.worker?worker&inline";

export const absurdWebBackend =
  ({
    wasmUrl,
    queryTimeout,
    pageSize,
    cacheSize,
  }: {
    wasmUrl: string | (() => Promise<string>);

    queryTimeout?: number;
    pageSize?: number;
    cacheSize?: number;
  }): IDbBackend =>
  ({ dbName }: { dbName: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const rawWorker: Worker = new RawWorker() as Worker;
    const isTerminated = reactiveVar(false, { label: "isTerminated" });

    const dbWorker = Comlink.wrap<DbWorker>(rawWorker);

    return {
      async initialize() {
        if (isTerminated.value) throw new Error("Db backend is terminated");

        initBackend(rawWorker);

        const url = typeof wasmUrl === "string" ? wasmUrl : await wasmUrl();

        await dbWorker.initialize(
          dbName,
          new URL(url, document.baseURI).toString(),
          pageSize !== undefined ? pageSize : 32 * 1024,
          cacheSize !== undefined ? cacheSize : -5000
        );
      },
      async execQueries(queries: IQuery[], transactionOpts?: ITransactionOpts) {
        const startedAt = getTime();
        const res = await dbWorker.execQueries(
          queries,
          new Date().getTime(),
          transactionOpts
        );
        const endAt = getTime();

        return {
          result: res.result,
          performance: {
            ...res.performance,
            receiveTime: new Date().getTime() - res.sentAt,
            totalTime: endAt - startedAt,
          },
        };
      },
      async stop() {
        isTerminated.value = true;

        await dbWorker.stop();
        rawWorker.terminate();
      },
    };
  };
