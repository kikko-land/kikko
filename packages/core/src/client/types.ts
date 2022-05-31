import { Observable, Subject } from "rxjs";

import { IInputWorkerMessage, IOutputWorkerMessage } from "../worker/types";
import { INanoEmitter } from "./createNanoEvents";
import { INotifyChannel } from "./utils";

export interface ITrongEvents {
  initialized: () => Promise<void>;
}

export interface ISharedState {
  messagesFromWorker$: Observable<IOutputWorkerMessage>;
  messagesToWorker$: Subject<IInputWorkerMessage>;
  eventsCh$: Observable<INotifyChannel>;
  stop$: Subject<void>;
  isStopped: boolean;
  dbName: string;
  eventsEmitter: INanoEmitter<ITrongEvents>;

  // Used to detect current tab id. Uniq for each tab
  clientId: string;
}

export interface IDbState {
  transaction?: {
    id: string;
    writeToTables: Set<string>;
  };
  suppressLog?: boolean;
  sharedState: ISharedState;
}
