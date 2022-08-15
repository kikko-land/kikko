import { IPrimitiveValue, ISql } from "@kikko-land/sql";

import { IDbState } from "./types";
import { makeId } from "./utils";

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

export type ITransferredQuery = { values: IPrimitiveValue[]; text: string };
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
  queries: ISql[]
): IExecQueriesCommand => {
  return {
    type: "runQueries",
    queries: queries.map((q) => ({
      values: q.preparedQuery.values,
      text: q.preparedQuery.text,
    })),
    spawnTransaction: false,
    commandId: makeId(),
    suppressLog: state.localState.suppressLog,
  };
};
