import { createNanoEvents } from "./createNanoEvents";
import { acquireJob, IJobsState, releaseJob, whenAllJobsDone } from "./job";
import { reactiveVar } from "./reactiveVar";
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
  const runningState = reactiveVar<"running" | "stopping" | "stopped">(
    "running",
    "runningState"
  );
  const dbBackendCalled = (await dbBackend)({
    dbName,
  });

  const jobsState = reactiveVar(
    {
      queue: [],
      current: undefined,
    } as IJobsState,
    "jobsState"
  );

  const state: IDbState = {
    sharedState: {
      clientId: makeId(),
      dbBackend: dbBackendCalled,
      dbName,

      runningState: runningState,

      eventsEmitter: createNanoEvents<IKikkoEvents>(),

      jobsState: jobsState,
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

  let currentState = state;

  try {
    const getRunningState = () => state.sharedState.runningState.value;

    if (getRunningState() !== "running") return state;

    await dbBackendCalled.initialize();

    if (getRunningState() !== "running") return state;

    for (const plugin of plugins || []) {
      currentState = plugin(currentState);
    }
  } finally {
    releaseJob(jobsState, job);
  }

  await state.sharedState.eventsEmitter.emit("initialized", state);

  return currentState;
};

export const stopDb = async (state: IDbState) => {
  state.sharedState.runningState.value = "stopping";

  await whenAllJobsDone(state.sharedState.jobsState);
  await state.sharedState.dbBackend.stop();

  state.sharedState.runningState.value = "stopped";

  queueMicrotask(() => {
    state.sharedState.runningState.stop();
    state.sharedState.jobsState.stop();
  });
};
