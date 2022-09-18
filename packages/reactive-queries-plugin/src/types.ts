import { ReactiveVar } from "@kikko-land/kikko";

import { INotifyChannel } from "./getBroadcastCh";

declare module "@kikko-land/kikko" {
  export interface ISharedDbState {
    reactiveQueriesState?: {
      rEventsCh: ReactiveVar<INotifyChannel | undefined>;
    };
  }
}
