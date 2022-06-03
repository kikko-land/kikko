import { QueryExecResult } from "@trong-orm/sql.js";

import { ICommand } from "../commands";

export type IResponse = {
  commandId: string;
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
