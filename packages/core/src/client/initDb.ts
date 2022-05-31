import { initBackend } from "absurd-sql/dist/indexeddb-main-thread";
import { nanoid } from "nanoid";
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

import { IInputWorkerMessage, IOutputWorkerMessage } from "../worker/types";
import { createNanoEvents } from "./createNanoEvents";
import { IDbState, IQueriesMiddleware, ITrongEvents } from "./types";

export type IDbPlugin = (state: IDbState) => IDbState;

export type IInitDbConfig = {
  dbName: string;
  worker: Worker;
  wasmUrl: string;
  plugins?: IDbPlugin[];
  queriesMiddlewares?: IQueriesMiddleware[];
};

export const initDb = async ({
  dbName,
  worker,
  wasmUrl,
  plugins,
  queriesMiddlewares,
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

  let state: IDbState = {
    sharedState: {
      clientId: nanoid(),
      messagesFromWorker$,
      messagesToWorker$,
      stop$,
      isStopped: false,
      dbName,
      eventsEmitter: createNanoEvents<ITrongEvents>(),
    },

    queriesMiddlewares: queriesMiddlewares || [],
  };

  for (const plugin of plugins || []) {
    state = plugin(state);
  }

  await state.sharedState.eventsEmitter.emit("initialized", state);

  return state;
};

export const stopDb = (state: IDbState) => {
  state.sharedState.stop$.next();

  state.sharedState.isStopped = true;
};
