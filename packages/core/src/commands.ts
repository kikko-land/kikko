import { Sql, PrimitiveValue } from "@trong-orm/sql";
import { nanoid } from "nanoid";

import { IDbState } from "./client/types";

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

export type ITransferredQuery = { values: PrimitiveValue[]; text: string };
export type IExecQueriesCommand = IBaseCommand & {
  type: "runQueries";
  queries: ITransferredQuery[];
  spawnTransaction?: boolean;
  transactionId?: string;
  commandId: string;
};

export type ICommand =
  | IStartTransactionCommand
  | IRollbackTransactionCommand
  | IExecQueriesCommand
  | ICommitTransactionCommand;

export const buildRunQueriesCommand = (
  state: IDbState,
  queries: Sql[]
): IExecQueriesCommand => {
  return {
    type: "runQueries",
    queries: queries.map((q) => ({ values: q.values, text: q.text })),
    spawnTransaction: false,
    commandId: nanoid(),
    suppressLog: state.localState.suppressLog,
  };
};
