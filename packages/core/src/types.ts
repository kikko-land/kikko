import { IBaseToken } from "@kikko-land/query-builder/src/types";
import { ISqlAdapter } from "@kikko-land/sql";
import { BehaviorSubject, Observable } from "rxjs";
import { DeepReadonly } from "ts-essentials";

import { INanoEmitter } from "./createNanoEvents";
import { IJobsState } from "./job";

export interface IKikkoEvents {
  initialized: (db: IDbState) => Promise<void> | void;
  transactionWillStart: (
    db: IDbState,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionStarted: (
    db: IDbState,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionWillCommit: (
    db: IDbState,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionCommitted: (
    db: IDbState,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionWillRollback: (
    db: IDbState,
    transaction: ITransaction
  ) => Promise<void> | void;
  transactionRollbacked: (
    db: IDbState,
    transaction: ITransaction
  ) => Promise<void> | void;
}

export interface ITransaction {
  id: string;
}

export type IQueriesMiddlewareState = {
  dbState: IDbState;
  result: IQueryResult[];
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

export interface IDbState {
  // mutable object
  sharedState: ISharedDbState;
  // immutable object
  localState: DeepReadonly<ILocalDbState>;
}

export type IQueryValue = number | string | Uint8Array | null;
export type IQuery = { values: IQueryValue[]; text: string };
export type IQueryResult = Record<string, IQueryValue>[];

type IDbInstance = {
  initialize(): Promise<void>;
  execQueries(
    queries: IQuery[],
    opts: { log: { suppress: boolean; transactionId?: string } }
  ): Promise<IQueryResult[]>;
};
export type IDbBackend = (db: {
  dbName: string;
  stopped$: Observable<void>;
}) => IDbInstance;

export interface ISharedDbState {
  dbName: string;
  dbBackend: ReturnType<IDbBackend>;

  runningState$: BehaviorSubject<"running" | "stopping" | "stopped">;
  stopStarted$: Observable<void>;

  eventsEmitter: INanoEmitter<IKikkoEvents>;

  // Used to detect current tab id. Uniq for each tab
  clientId: string;

  jobsState$: BehaviorSubject<IJobsState>;

  transactionsState: {
    current?: ITransaction;
  };
}

export interface ILocalDbState {
  transactionsState: {
    current?: ITransaction;
  };
  suppressLog?: boolean;
  queriesMiddlewares: IQueriesMiddleware[];
}
