import { Observable } from "rxjs";

import { INotifyChannel } from "./getBroadcastCh";

declare module "@kikko-land/kikko" {
  export interface ISharedDbState {
    reactiveQueriesState?: {
      eventsCh$: Observable<INotifyChannel>;
    };
  }
}
