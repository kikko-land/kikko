import { Sql } from "@trong-orm/sql";
import { Observable, Subject } from "rxjs";
import { DeepReadonly } from "ts-essentials";

import { IInputWorkerMessage, IOutputWorkerMessage } from "../worker/types";
import { INanoEmitter } from "./createNanoEvents";
import { IJobState } from "./job";

export interface ITrongEvents {
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
  result: Record<string, unknown>[][];
  queries: Sql[];
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
  sharedState: ISharedState;
  // immutable object
  localState: DeepReadonly<{
    transactionsState: {
      currentlyRunning?: ITransaction;
    };
    suppressLog?: boolean;
    queriesMiddlewares: IQueriesMiddleware[];
  }>;
}

export interface ISharedState {
  messagesFromWorker$: Observable<IOutputWorkerMessage>;
  messagesToWorker$: Subject<IInputWorkerMessage>;
  stop$: Subject<void>;
  isStopped: boolean;
  dbName: string;
  eventsEmitter: INanoEmitter<ITrongEvents>;

  // Used to detect current tab id. Uniq for each tab
  clientId: string;

  jobsState: IJobState;

  transactionsState: {
    currentlyRunning?: ITransaction;
  };
}
