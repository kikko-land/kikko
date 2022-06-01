import { QueryExecResult } from "@harika-org/sql.js";
import { Sql } from "@trong/sql";
import { Observable, Subject } from "rxjs";

import { IInputWorkerMessage, IOutputWorkerMessage } from "../worker/types";
import { INanoEmitter } from "./createNanoEvents";

export interface ITrongEvents {
  initialized: (db: IDbState) => Promise<void> | void;
  transactionWillStart: (
    db: IDbState,
    transaction: ITransactionState
  ) => Promise<void> | void;
  transactionStarted: (
    db: IDbState,
    transaction: ITransactionState
  ) => Promise<void> | void;
  transactionWillCommit: (
    db: IDbState,
    transaction: ITransactionState
  ) => Promise<void> | void;
  transactionCommitted: (
    db: IDbState,
    transaction: ITransactionState
  ) => Promise<void> | void;
  transactionWillRollback: (
    db: IDbState,
    transaction: ITransactionState
  ) => Promise<void> | void;
  transactionRollbacked: (
    db: IDbState,
    transaction: ITransactionState
  ) => Promise<void> | void;
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
}

export interface ITransactionState {
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
  transaction?: ITransactionState;
  suppressLog?: boolean;
  sharedState: ISharedState;
  queriesMiddlewares: IQueriesMiddleware[];
}
