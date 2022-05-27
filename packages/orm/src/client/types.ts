import { Observable, Subject } from "rxjs";
import { IOutputWorkerMessage, IInputWorkerMessage } from "../worker/types";
import { IMigration } from "../types";
import { BroadcastChannel } from "broadcast-channel";

export interface ISharedState {
  messagesFromWorker$: Observable<IOutputWorkerMessage>;
  messagesToWorker$: Subject<IInputWorkerMessage>;
  eventsCh$: Observable<BroadcastChannel<string[]>>;
  stop$: Subject<void>;
  isStopped: boolean;
  dbName: string;
  migrations: IMigration[];
}

export interface IDbState {
  transaction?: {
    id: string;
    writeToTables: Set<string>;
  };
  suppressLog?: boolean;
  sharedState: ISharedState;
}
