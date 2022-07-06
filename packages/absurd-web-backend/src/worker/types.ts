import { ICommand } from "../commands";

export type IResponse = {
  commandId: string;
} & (
  | {
      status: "success";
      result: Record<string, number | string | Uint8Array | null>[][];
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
  | {
      type: "initialize";
      dbName: string;
      wasmUrl: string;
      pageSize: number;
      cacheSize: number;
    }
  | { type: "command"; data: ICommand };
