import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  map,
  of,
  pipe,
  switchMap,
  take,
} from "rxjs";

import { createNanoEvents } from "./createNanoEvents";
import { acquireJob, IJobsState, releaseJob, whenAllJobsDone } from "./job";
import {
  IDbBackend,
  IDbState,
  IKikkoEvents,
  IQueriesMiddleware,
} from "./types";
import { makeId } from "./utils";

export type IDbClientPlugin = (state: IDbState) => IDbState;

export type IInitDbClientConfig = {
  dbName: string;
  dbBackend: Promise<IDbBackend> | IDbBackend;
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

  const dbBackendCalled = (await dbBackend)({
    dbName,
    stopped$: runningState$.pipe(
      filter((e) => e === "stopped"),
      map(() => undefined as void),
      take(1)
    ),
  });

  const jobsState$ = new BehaviorSubject<IJobsState>({
    queue: [],
    current: undefined,
  });

  const state: IDbState = {
    sharedState: {
      clientId: makeId(),
      dbBackend: dbBackendCalled,
      dbName,

      runningState$,
      stopStarted$: runningState$.pipe(
        filter((e) => e === "stopping"),
        map(() => undefined as void),
        take(1)
      ),

      eventsEmitter: createNanoEvents<IKikkoEvents>(),

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
    switchMap(async (currentState) => {
      releaseJob(jobsState$, job);

      await state.sharedState.eventsEmitter.emit("initialized", state);
      return currentState;
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

  console.log("stopped db");

  state.sharedState.runningState$.next("stopped");
};
