import { Observable, Subject } from "rxjs";

import { IInputWorkerMessage, IOutputWorkerMessage } from "./worker/types";

export interface IBackendState {
  messagesToWorker$: Subject<IInputWorkerMessage>;
  messagesFromWorker$: Observable<IOutputWorkerMessage>;
  stop$: Observable<void>;
  queryTimeout: number;
}
