import { IDbBackend, IQuery } from "@trong-orm/core";
import { initBackend } from "absurd-sql/dist/indexeddb-main-thread";
import {
  filter,
  first,
  lastValueFrom,
  Observable,
  ReplaySubject,
  share,
  Subject,
  takeUntil,
} from "rxjs";

import { buildRunQueriesCommand } from "./commands";
import { runWorkerCommand } from "./runWorkerCommand";
import { IBackendState } from "./types";
import { IInputWorkerMessage, IOutputWorkerMessage } from "./worker/types";

export const initAbsurdWebBackend =
  ({
    worker,
    wasmUrl,
    queryTimeout,
  }: {
    worker: Worker;
    wasmUrl: string;
    queryTimeout?: number;
  }) =>
  ({
    dbName,
    stop$,
  }: {
    dbName: string;
    stop$: Observable<void>;
  }): IDbBackend => {
    const messagesToWorker$ = new Subject<IInputWorkerMessage>();
    messagesToWorker$.pipe(takeUntil(stop$)).subscribe((mes) => {
      worker.postMessage(mes);
    });

    const messagesFromWorker$ = new Observable<IOutputWorkerMessage>((obs) => {
      const sub = (ev: MessageEvent<IOutputWorkerMessage>) => {
        // console.log(
        //   `[DB][${
        //     ev.data.type === 'response' && ev.data.data.commandId
        //   }] new message from worker`,
        //   ev.data,
        // );
        obs.next(ev.data);
      };
      worker.addEventListener("message", sub);

      return () => {
        worker.removeEventListener("message", sub);
      };
    }).pipe(
      share({
        connector: () => new ReplaySubject(20),
        resetOnRefCountZero: false,
      }),
      takeUntil(stop$)
    );

    stop$.pipe(first()).subscribe(() => {
      worker.terminate();
    });

    const state: IBackendState = {
      messagesToWorker$,
      messagesFromWorker$,
      stop$,
      queryTimeout: queryTimeout || 30_000,
    };

    return {
      async initialize() {
        initBackend(worker);

        const initPromise = lastValueFrom(
          messagesFromWorker$.pipe(
            filter((ev) => ev.type === "initialized"),
            first(),
            takeUntil(stop$)
          )
        );

        messagesToWorker$.next({
          type: "initialize",
          dbName: dbName,
          wasmUrl: wasmUrl,
        });

        await initPromise;
      },
      execQueries(queries: IQuery[], opts) {
        return runWorkerCommand(state, buildRunQueriesCommand(queries, opts));
      },
    };
  };
