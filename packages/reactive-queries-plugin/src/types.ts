import { Observable } from "rxjs";

import { INotifyChannel } from "./getBroadcastCh";

declare module "@trong-orm/core" {
  export interface ISharedDbState {
    reactiveQueriesState?: {
      eventsCh$: Observable<INotifyChannel>;
    };
  }
}
