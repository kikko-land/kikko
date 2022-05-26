import { nanoid } from "nanoid";
import { Sql } from "../Sql";
import { IDbState } from "./example";

type IBaseCommand = {
  suppressLog?: boolean;
};

export type IStartTransactionCommand = IBaseCommand & {
  type: "startTransaction";
  transactionId: string;
  commandId: string;
};
export type ICommitTransactionCommand = IBaseCommand & {
  type: "commitTransaction";
  transactionId: string;
  commandId: string;
};
export type IRollbackTransactionCommand = IBaseCommand & {
  type: "rollbackTransaction";
  transactionId: string;
  commandId: string;
};

type ITransactionCommand =
  | IStartTransactionCommand
  | ICommitTransactionCommand
  | IRollbackTransactionCommand;

export type IExecQueriesCommand = IBaseCommand & {
  type: "execQueries";
  queries: Sql[];
  spawnTransaction?: boolean;
  transactionId?: string;
  commandId: string;
};

export type ICommand =
  | IStartTransactionCommand
  | IRollbackTransactionCommand
  | IExecQueriesCommand
  | ICommitTransactionCommand;

export const buildTransactionCommand = (
  state: IDbState,
  type: ITransactionCommand["type"]
): ITransactionCommand => {
  if (!state.transactionId) {
    throw new Error("Transaction id not set in state");
  }

  return {
    type,
    transactionId: state.transactionId,
    commandId: nanoid(),
  };
};

// rename to "run"
export const buildExecQueriesCommand = (
  state: IDbState,
  queries: Sql[]
): IExecQueriesCommand => {
  return {
    type: "execQueries",
    queries,
    spawnTransaction: queries.length > 1 && !state.transactionId,
    transactionId: state.transactionId,
    commandId: nanoid(),
  };
};
