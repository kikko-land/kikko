import { Observable } from "rxjs";

import { INotifyChannel } from "./getBroadcastCh";

declare module "@trong/core" {
  export interface ISharedState {
    reactiveQueriesState?: {
      eventsCh$: Observable<INotifyChannel>;
    };
  }
}
