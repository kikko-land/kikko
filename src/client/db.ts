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
  startWith,
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
import { IMigration } from "../types";
import { runMigrations } from "./runMigrations";
import { BroadcastChannel } from "broadcast-channel";
import { getBroadcastCh$ } from "./utils";
import { QueryExecResult } from "@harika-org/sql.js";

export interface ISharedState {
  messagesFromWorker$: Observable<IOutputWorkerMessage>;
  messagesToWorker$: Subject<IInputWorkerMessage>;
  eventsCh$: Observable<BroadcastChannel<string[]>>;
  stop$: Subject<void>;
  isStopped: boolean;
  dbName: string;
  migrations: IMigration[];
}

export interface IDbState {
  transaction?: {
    id: string;
    touchedTables: Set<string>;
  };
  suppressLog?: boolean;
  sharedState: ISharedState;
}

const chunk = <T>(array: Array<T>, chunkSize: number): T[][] =>
  Array(Math.ceil(array.length / chunkSize))
    .fill(null)
    .map((_, index) => index * chunkSize)
    .map((begin) => array.slice(begin, begin + chunkSize));

const notifyTables = async (state: IDbState, tables: string[]) => {
  return lastValueFrom(
    state.sharedState.eventsCh$.pipe(
      first(),
      switchMap(async (ch) => {
        await ch.postMessage(tables);
      })
    )
  );
};

export const initDb = async ({
  dbName,
  worker,
  wasmUrl,
  migrations,
}: {
  dbName: string;
  worker: Worker;
  wasmUrl: string;
  migrations?: [];
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

  const state: IDbState = {
    sharedState: {
      messagesFromWorker$,
      messagesToWorker$,
      stop$,
      eventsCh$: getBroadcastCh$(dbName, stop$),
      isStopped: false,
      dbName,
      migrations: migrations || [],
    },
  };

  await runMigrations(state);

  return state;
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
  if (state.transaction?.id) {
    // we already in transaction
    return await func(state);
  }

  state = { ...state, transaction: { id: nanoid(), touchedTables: new Set() } };

  await runCommand(state, buildTransactionCommand(state, "startTransaction"));

  try {
    const res = await func(state);

    await runCommand(
      state,
      buildTransactionCommand(state, "commitTransaction")
    );

    // dont await so notification happens after function return
    void notifyTables(state, [...state.transaction!.touchedTables]);

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

export const runQueries = async (state: IDbState, queries: Sql[]) => {
  const res = await runCommand(state, buildExecQueriesCommand(state, queries));

  return res;
};
export const runQueries$ = (state: IDbState, queries: Sql[]) => {
  const tables = new Set(queries.flatMap((q) => q.tables));

  // TODO extract
  return state.sharedState.eventsCh$.pipe(
    switchMap((ch) => {
      return new Observable<string[]>((subscriber) => {
        const func = (data: string[]) => {
          subscriber.next(data);
        };

        ch.addEventListener("message", func);

        return () => {
          void ch.close();
        };
      });
    }),
    filter((changesInTables) =>
      changesInTables.some((table) => tables.has(table))
    ),
    startWith(undefined),
    switchMap(async () => {
      return runQueries(state, queries);
    }),
    takeUntil(state.sharedState.stop$)
  );
};

export const runQuery = async (state: IDbState, query: Sql) => {
  return (await runQueries(state, [query]))[0];
};
export const runQuery$ = async (state: IDbState, query: Sql) => {
  return runQueries$(state, [query]).pipe(map((list) => list[0]));
};

export const insertRecords = async (
  state: IDbState,
  table: string,
  objs: Record<string, any>[],
  replace: boolean = false
) => {
  if (objs.length === 0) return;

  if (state.transaction) {
    state.transaction.touchedTables.add(table);
  }

  // sqlite max vars = 32766
  // Let's take table columns count to 20, so 20 * 1000 will fit the restriction
  const chunked = chunk(objs, 1000);

  const toExec = async (state: IDbState) => {
    for (const chunkObjs of chunk(objs, 1000)) {
      // TODO: maybe runQueries? But then a large object will need to be transferred, that may cause freeze
      await runQuery(state, generateInsert(table, chunkObjs, replace));
    }
  };

  await (chunked.length > 1 ? runInTransaction(state, toExec) : toExec(state));

  if (!state.transaction) {
    // dont await so notification happens after function return
    void notifyTables(state, [table]);
  }
};

const mapToRecords = <T extends Record<string, any>>(
  result: QueryExecResult
) => {
  return (result?.values?.map((res) => {
    let obj: Record<string, any> = {};

    result.columns.forEach((col, i) => {
      obj[col] = res[i];
    });

    return obj;
  }) || []) as T[];
};

export const getRecords = async <T extends Record<string, any>>(
  state: IDbState,
  query: Sql
) => {
  const [result] = await runQuery(state, query);

  return mapToRecords<T>(result);
};

export const getRecords$ = async <T extends Record<string, any>>(
  state: IDbState,
  query: Sql
) => {};

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
