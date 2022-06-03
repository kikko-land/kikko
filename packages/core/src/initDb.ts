import { nanoid } from "nanoid";
import { BehaviorSubject, filter, first, map, Observable, Subject } from "rxjs";

import { createNanoEvents } from "./createNanoEvents";
import { acquireJob, IJob, releaseJob, whenAllJobsDone } from "./job";
import {
  IDbBackend,
  IDbState,
  IQueriesMiddleware,
  ITrongEvents,
} from "./types";

export type IDbClientPlugin = (state: IDbState) => IDbState;

export type IInitDbClientConfig = {
  dbName: string;
  dbBackend: (db: { dbName: string; stopped$: Observable<void> }) => IDbBackend;
  plugins?: IDbClientPlugin[];
  queriesMiddlewares?: IQueriesMiddleware[];
};

export const initDbClient = async ({
  dbName,
  plugins,
  queriesMiddlewares,
  dbBackend,
}: IInitDbClientConfig): Promise<IDbState> => {
  const runningState$ = new BehaviorSubject<"running" | "stopping" | "stopped">(
    "running"
  );

  const dbBackendCalled = dbBackend({
    dbName,
    stopped$: runningState$.pipe(
      filter((e) => e === "stopped"),
      map(() => undefined as void),
      first()
    ),
  });

  let state: IDbState = {
    sharedState: {
      clientId: nanoid(),
      dbBackend: dbBackendCalled,
      dbName,

      runningState$,
      stopStarted$: runningState$.pipe(
        filter((e) => e === "stopping"),
        map(() => undefined as void),
        first()
      ),

      eventsEmitter: createNanoEvents<ITrongEvents>(),

      jobsState: {
        queue: [],
        next$: new Subject<IJob>(),
      },
      transactionsState: {},
    },
    localState: {
      queriesMiddlewares: queriesMiddlewares || [],
      transactionsState: {},
    },
  };

  const job = await acquireJob(state.sharedState.jobsState, {
    type: "initDb",
    name: dbName,
  });

  try {
    await dbBackendCalled.initialize();

    for (const plugin of plugins || []) {
      state = plugin(state);
    }

    return state;
  } finally {
    releaseJob(state.sharedState.jobsState, job);

    await state.sharedState.eventsEmitter.emit("initialized", state);
  }
};

export const stopDb = async (state: IDbState) => {
  state.sharedState.runningState$.next("stopping");

  await whenAllJobsDone(state.sharedState.jobsState);

  state.sharedState.runningState$.next("stopped");
};
