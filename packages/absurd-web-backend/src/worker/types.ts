import { ICommand } from "../commands";

export type IResponse = {
  commandId: string;
} & (
  | {
      status: "success";
      result: {
        rows: Record<string, number | string | Uint8Array | null>[];
        performance: {
          prepareTime: number;
          execTime: number;
          freeTime: number;
        };
      }[];
      performance: {
        sendTime: number;
        blockTime: number;
      };
      sentAt: number;
    }
  | {
      status: "error";
      message: string;
    }
);

export type IOutputWorkerMessage =
  | { type: "initialized" }
  | { type: "response"; data: IResponse }
  | { type: "stopped" };

export type IInputWorkerMessage =
  | {
      type: "initialize";
      dbName: string;
      wasmUrl: string;
      pageSize: number;
      cacheSize: number;
    }
  | { type: "command"; data: ICommand; sentAt: number }
  | { type: "stop" };
