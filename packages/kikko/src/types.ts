import { IBaseToken } from "@kikko-land/query-builder/src/types";
import { ISqlAdapter } from "@kikko-land/sql";
import { DeepReadonly } from "ts-essentials";

import { INanoEmitter } from "./createNanoEvents";
import { IJobsState } from "./job";
import { ReactiveVar } from "./reactiveVar";

export type IKikkoEvents = {
  initialized: (db: IDb) => Promise<void> | void;
  transactionWillStart: (
    db: IDb,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionStarted: (
    db: IDb,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionWillCommit: (
    db: IDb,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionCommitted: (
    db: IDb,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionWillRollback: (
    db: IDb,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionRollbacked: (
    db: IDb,
    transaction: ITransaction
  ) => Promise<void> | void;
};

export interface ITransaction {
  id: string;
  type: "atomic" | "async";
}

export type IQueriesMiddlewareState = {
  db: IDb;
  result: {
    rows: IQueryResult;
    performance: {
      prepareTime: number;
      execTime: number;
      freeTime: number;
    };
  }[];
  performance: {
    sendTime: number;
    receiveTime: number;
    totalTime: number;
  };
  queries: (IBaseToken | ISqlAdapter)[];
};

export type INextQueriesMiddleware = (
  args: IQueriesMiddlewareState
) => Promise<IQueriesMiddlewareState>;

export type IQueriesMiddleware = (
  args: IQueriesMiddlewareState & {
    next: INextQueriesMiddleware;
  }
) => Promise<IQueriesMiddlewareState>;

export interface IAtomicTransactionScope {
  __state: {
    queries: ISqlAdapter[];
  };
  addQuery(q: ISqlAdapter): void;
}

export interface IDb {
  __state: {
    // mutable object
    sharedState: ISharedDbState;
    // immutable object
    localState: DeepReadonly<ILocalDbState>;
  };

  transaction<T>(
    func: (state: IDb) => Promise<T>,
    opts?: { label?: string; type?: "deferred" | "immediate" | "exclusive" }
  ): Promise<T>;
  atomicTransaction(
    func:
      | ((scope: IAtomicTransactionScope) => Promise<void> | void)
      | ISqlAdapter[],
    opts?: { label?: string; type?: "deferred" | "immediate" | "exclusive" }
  ): Promise<void>;

  runQueries<D extends Record<string, unknown>>(
    queries: ISqlAdapter[]
  ): Promise<D[][]>;
  runQuery<D extends Record<string, unknown>>(query: ISqlAdapter): Promise<D[]>;
}

export type IQueryValue = number | string | Uint8Array | null;
export type IQuery = { values: IQueryValue[]; text: string };
export type IQueryResult = Record<string, IQueryValue>[];

type IDbInstance = {
  initialize(): Promise<void>;
  execQueries(queries: IQuery[]): Promise<{
    result: {
      rows: IQueryResult;
      performance: {
        prepareTime: number;
        execTime: number;
        freeTime: number;
      };
    }[];
    performance: {
      sendTime: number;
      receiveTime: number;
      totalTime: number;
    };
  }>;
  stop(): Promise<void>;
};
export type IDbBackend = (db: { dbName: string }) => IDbInstance;

export type ITransactionPerformance = {
  prepareTime: number;
  execTime: number;
  freeTime: number;
  sendTime: number;
  receiveTime: number;
  totalTime: number;
};

export interface ISharedDbState {
  dbName: string;
  dbBackend: ReturnType<IDbBackend>;

  runningState: ReactiveVar<"running" | "stopping" | "stopped">;

  eventsEmitter: INanoEmitter<IKikkoEvents>;

  // Used to detect current tab id. Uniq for each tab
  clientId: string;

  jobsState: ReactiveVar<IJobsState>;

  transactionsState?: {
    current: ITransaction;
    performance: ITransactionPerformance;
  };
  transactionLoggingState: {
    i: number;
    id: string | undefined;
  };
}

export interface ILocalDbState {
  transactionsState: {
    current?: ITransaction;
  };
  suppressLog?: boolean;
  queriesMiddlewares: IQueriesMiddleware[];
}
