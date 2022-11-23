import { ISqlAdapter } from "@kikko-land/boono-sql";
import { DeepReadonly } from "ts-essentials";

import { INanoEmitter } from "./createNanoEvents";
import { ReactiveVar } from "./reactiveVar";

export type ICmdPerformance = {
  blockTime?: number;
  sendTime?: number;
  receiveTime?: number;
  totalTime: number;
};

export type IStatementPerformance = {
  execTime?: number;
  prepareTime?: number;
  freeTime?: number;
};

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
    performance: IStatementPerformance;
  }[];
  performance: ICmdPerformance & { unwrapQueriesTime?: number };
  queries: ISqlAdapter[];
  transactionOpts?: ITransactionOpts;
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
    afterCommits: (() => void)[];
    afterRollbacks: (() => void)[];
  };
  addQuery(q: ISqlAdapter): void;
  afterCommit(cb: () => void): void;
  afterRollback(cb: () => void): void;
}

export interface IDb {
  __state: {
    // mutable object
    sharedState: ISharedDbState;
    // immutable object
    localState: DeepReadonly<ILocalDbState>;
  };

  runInTransaction<T>(
    func: (state: IDb) => Promise<T>,
    opts?: { type?: "deferred" | "immediate" | "exclusive" }
  ): Promise<T>;
  runInAtomicTransaction(
    func:
      | ((scope: IAtomicTransactionScope) => Promise<void> | void)
      | ISqlAdapter[],
    opts?: { type?: "deferred" | "immediate" | "exclusive" }
  ): Promise<void>;

  runQueries<D extends Record<string, unknown>>(
    queries: ISqlAdapter[]
  ): Promise<D[][]>;
  runQuery<D extends Record<string, unknown>>(query: ISqlAdapter): Promise<D[]>;

  runAfterTransactionCommitted(
    func: (db: IDb, transaction: ITransaction) => void
  ): void;
  runAfterTransactionRollbacked(
    func: (db: IDb, transaction: ITransaction) => void
  ): void;
}

export type IQueryValue = number | string | Uint8Array | null;
export type IQuery = { values: IQueryValue[]; text: string };
export type IQueryResult = Record<string, IQueryValue>[];
export type IExecQueriesResult = {
  result: {
    rows: IQueryResult;
    performance: IStatementPerformance;
  }[];
  performance: ICmdPerformance;
};

type IDbInstance = {
  isUsualTransactionDisabled?: true;
  isAtomicRollbackCommitDisabled?: true;

  initialize(): Promise<void>;
  execQueries(
    queries: IQuery[],
    transactionOpts?: ITransactionOpts
  ): Promise<IExecQueriesResult>;
  stop(): Promise<void>;
};
export type IDbBackend = (db: { dbName: string }) => IDbInstance;

export type ITransactionPerformance = {
  freeTime?: number;
  sendTime?: number;
  receiveTime?: number;
  prepareTime?: number;
  execTime?: number;
  totalTime: number;
  blockTime: number;
};

export type ILogFns = {
  logQuery: (msg: string, i: number | undefined) => void;
  logError: (msg: string, context: unknown) => void;
  logTrFinish: (msg: string) => void;
};

export interface ISharedDbState {
  dbName: string;
  dbBackend: ReturnType<IDbBackend>;
  logFns: ILogFns;

  runningState: ReactiveVar<"running" | "stopping" | "stopped">;

  eventsEmitter: INanoEmitter<IKikkoEvents>;

  // Used to detect current tab id. Uniq for each tab
  clientId: string;

  transactionsStates: {
    byId: {
      [transactionId: string]: {
        i: number;
        current: ITransaction;
        performance: ITransactionPerformance;
      };
    };
  };
}

export interface ILocalDbState {
  transactionState: {
    current?: ITransaction;
  };
  suppressLog?: boolean;
  queriesMiddlewares: IQueriesMiddleware[];
}

export interface ITransactionOpts {
  transactionId: string;
  containsTransactionStart: boolean;
  containsTransactionFinish: boolean;
  containsTransactionRollback: boolean;
  rollbackOnFail: boolean;
  isAtomic: boolean;
}
