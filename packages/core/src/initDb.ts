import { nanoid } from "nanoid";
import {
  BehaviorSubject,
  filter,
  finalize,
  first,
  firstValueFrom,
  map,
  Observable,
  of,
  pipe,
  Subject,
  switchMap,
} from "rxjs";

import { createNanoEvents } from "./createNanoEvents";
import {
  acquireJob,
  IJob,
  IJobsState,
  releaseJob,
  whenAllJobsDone,
} from "./job";
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

  const jobsState$ = new BehaviorSubject<IJobsState>({
    queue: [],
    current: undefined,
  });

  const state: IDbState = {
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

      jobsState$,
      transactionsState: {},
    },
    localState: {
      queriesMiddlewares: queriesMiddlewares || [],
      transactionsState: {},
    },
  };

  const job = await acquireJob(state.sharedState.jobsState$, {
    type: "initDb",
    name: dbName,
  });

  const initializerPipe = pipe(
    switchMap(async () => {
      await dbBackendCalled.initialize();
    }),
    map(() => {
      let currentState = state;

      for (const plugin of plugins || []) {
        currentState = plugin(state);
      }

      return currentState;
    }),
    finalize(() => {
      releaseJob(jobsState$, job);

      state.sharedState.eventsEmitter.emit("initialized", state);
    })
  );

  return firstValueFrom(
    state.sharedState.runningState$.pipe(
      switchMap((runningState) =>
        runningState === "running"
          ? of(undefined).pipe(initializerPipe)
          : of(state)
      )
    )
  );
};

export const stopDb = async (state: IDbState) => {
  state.sharedState.runningState$.next("stopping");

  await whenAllJobsDone(state.sharedState.jobsState$);

  setTimeout(() => {
    console.log("stopped db");
  }, 0);

  state.sharedState.runningState$.next("stopped");
};
