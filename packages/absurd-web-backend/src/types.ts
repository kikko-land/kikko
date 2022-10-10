import { ReactiveVar } from "@kikko-land/kikko";

import { IInputWorkerMessage, IOutputWorkerMessage } from "./worker/types";

export interface IBackendState {
  outcomingMessagesQueue: ReactiveVar<IInputWorkerMessage[]>;
  incomingMessagesQueue: ReactiveVar<IOutputWorkerMessage[]>;
  queryTimeout: number;
  isTerminated: ReactiveVar<boolean>;
}
