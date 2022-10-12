import { ReactiveVar } from "@kikko-land/kikko";
import { ISqlAdapter } from "@kikko-land/sql";

import { INotifyChannel } from "./getBroadcastCh";

declare module "@kikko-land/kikko" {
  export interface ISharedDbState {
    reactiveQueriesState?: {
      rEventsCh: ReactiveVar<INotifyChannel | undefined>;
    };
  }

  export interface IDb {
    listenQueries<D extends Record<string, unknown>>(
      queries: ISqlAdapter[],
      subscriber: (evs: D[][]) => void
    ): () => void;
  }
}
