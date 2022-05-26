import { initBackend } from "absurd-sql/dist/indexeddb-main-thread";
import { nanoid } from "nanoid";
import {
  filter,
  first,
  lastValueFrom,
  map,
  Observable,
  of,
  ReplaySubject,
  share,
  Subject,
  switchMap,
  takeUntil,
  throwError,
  timeout,
} from "rxjs";
import { Sql } from "../Sql";
import { IOutputWorkerMessage, IInputWorkerMessage } from "../worker/types";
import {
  buildExecQueriesCommand,
  buildTransactionCommand,
  ICommand,
} from "../commands";
import { generateInsert } from "./sqlHelpers";

export interface ISharedState {
  messagesFromWorker$: Observable<IOutputWorkerMessage>;
  messagesToWorker$: Subject<IInputWorkerMessage>;
  stop$: Subject<void>;
  isStopped: boolean;
  dbName: string;
}

export interface IDbState {
  transactionId?: string;
  suppressLog?: boolean;
  sharedState: ISharedState;
}

const chunk = <T>(array: Array<T>, chunkSize: number): T[][] =>
  Array(Math.ceil(array.length / chunkSize))
    .fill(null)
    .map((_, index) => index * chunkSize)
    .map((begin) => array.slice(begin, begin + chunkSize));

export const initDb = async ({
  dbName,
  worker,
  wasmUrl,
}: {
  dbName: string;
  worker: Worker;
  wasmUrl: string;
}): Promise<IDbState> => {
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

  return {
    sharedState: {
      messagesFromWorker$,
      messagesToWorker$,
      stop$,
      isStopped: false,
      dbName,
    },
  };
};

const runCommand = (state: IDbState, command: ICommand) => {
  if (state.sharedState.isStopped) {
    throw new Error(
      `Failed to execute function, DB ${state.sharedState.dbName} is stopped!`
    );
  }

  const { messagesFromWorker$, messagesToWorker$ } = state.sharedState;

  const waitResponse = lastValueFrom(
    messagesFromWorker$.pipe(
      filter(
        (ev) =>
          ev.type === "response" && ev.data.commandId === command.commandId
      ),
      first(),
      switchMap((ev) => {
        if (ev.type === "response" && ev.data.status === "error") {
          throw new Error(ev.data.message);
        } else {
          return of(ev);
        }
      }),
      map((ev) => {
        if (ev.type === "response" && ev.data.status === "success") {
          return ev.data.result;
        } else {
          throw new Error("Unknown data format");
        }
      }),
      timeout({
        each: 8000,
        with: () =>
          throwError(
            () =>
              new Error(
                `Failed to execute ${JSON.stringify(command)} - timeout`
              )
          ),
      }),
      takeUntil(state.sharedState.stop$)
    )
  );

  messagesToWorker$.next({
    type: "command",
    data: command,
  });

  return waitResponse;
};

export const runInTransaction = async <T>(
  state: IDbState,
  func: (state: IDbState) => Promise<T>
) => {
  if (state.transactionId) {
    // we already in transaction
    return await func(state);
  }

  state = { ...state, transactionId: nanoid() };

  await runCommand(state, buildTransactionCommand(state, "startTransaction"));

  try {
    const res = await func(state);

    await runCommand(
      state,
      buildTransactionCommand(state, "commitTransaction")
    );

    return res;
  } catch (e) {
    console.error("Rollback transaction", e);

    await runCommand(
      state,
      buildTransactionCommand(state, "rollbackTransaction")
    );

    throw e;
  }
};

export const runQueries = (state: IDbState, queries: Sql[]) => {
  return runCommand(state, buildExecQueriesCommand(state, queries));
};

export const runQuery = async (state: IDbState, query: Sql) => {
  return (await runQueries(state, [query]))[0];
};

export const insertRecords = (
  state: IDbState,
  table: string,
  objs: Record<string, any>[],
  replace: boolean = false
) => {
  if (objs.length === 0) return;

  // sqlite max vars = 32766
  // Let's take table columns count to 20, so 20 * 1000 will fit the restriction
  const chunked = chunk(objs, 1000);

  const toExec = async (state: IDbState) => {
    for (const chunkObjs of chunk(objs, 1000)) {
      // TODO: maybe runQueries? But then a large object will need to be transferred, that may cause freeze
      await runQuery(state, generateInsert(table, chunkObjs, replace));
    }
  };

  return chunked.length > 1 ? runInTransaction(state, toExec) : toExec(state);
};

export const getRecords = async <T extends Record<string, any>>(
  state: IDbState,
  query: Sql
) => {
  const [result] = await runQuery(state, query);

  return (result?.values?.map((res) => {
    let obj: Record<string, any> = {};

    result.columns.forEach((col, i) => {
      obj[col] = res[i];
    });

    return obj;
  }) || []) as T[];
};

export const suppressLog = <T>(
  state: IDbState,
  func: (state: IDbState) => T
): T => {
  return func({ ...state, suppressLog: true });
};

export const stop = (state: IDbState) => {
  state.sharedState.stop$.next();

  state.sharedState.isStopped = true;
};
