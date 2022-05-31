import { QueryExecResult } from "@harika-org/sql.js";

import { ICommand } from "../commands";

export type IResponse = {
  commandId: string;
  transactionId?: string;
} & (
  | {
      status: "success";
      result: QueryExecResult[][];
    }
  | {
      status: "error";
      message: string;
    }
);

export type IOutputWorkerMessage =
  | { type: "initialized" }
  | { type: "response"; data: IResponse };

export type IInputWorkerMessage =
  | { type: "initialize"; dbName: string; wasmUrl: string }
  | { type: "command"; data: ICommand };