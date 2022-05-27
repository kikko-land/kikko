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
import { IOutputWorkerMessage, IInputWorkerMessage } from "../worker/types";
import { runMigrations } from "./runMigrations";
import { getBroadcastCh$ } from "./utils";
import { IDbState } from "./types";

export type IInitDbConfig = {
  dbName: string;
  worker: Worker;
  wasmUrl: string;
  migrations?: [];
};

export const initDb = async ({
  dbName,
  worker,
  wasmUrl,
  migrations,
}: IInitDbConfig): Promise<IDbState> => {
  initBackend(worker);

  const stop$ = new Subject<void>();

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

  const messagesToWorker$ = new Subject<IInputWorkerMessage>();
  messagesToWorker$.pipe(takeUntil(stop$)).subscribe((mes) => {
    worker.postMessage(mes);
  });

  messagesToWorker$.next({
    type: "initialize",
    dbName: dbName,
    wasmUrl: wasmUrl,
  });

  await lastValueFrom(
    messagesFromWorker$.pipe(
      filter((ev) => ev.type === "initialized"),
      first(),
      takeUntil(stop$)
    )
  );

  const state: IDbState = {
    sharedState: {
      messagesFromWorker$,
      messagesToWorker$,
      stop$,
      eventsCh$: getBroadcastCh$(dbName + "-tableContentChanges", stop$),
      isStopped: false,
      dbName,
      migrations: migrations || [],
    },
  };

  await runMigrations(state);

  return state;
};

export const stopDb = (state: IDbState) => {
  state.sharedState.stop$.next();

  state.sharedState.isStopped = true;
};
