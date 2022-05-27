import {
  first,
  lastValueFrom,
  Observable,
  ReplaySubject,
  share,
  switchMap,
  takeUntil,
} from "rxjs";
import { BroadcastChannel } from "broadcast-channel";
import { IDbState } from "./types";

export const getBroadcastCh$ = (name: string, stop$: Observable<void>) => {
  return new Observable<BroadcastChannel>((sub) => {
    let currentChannel: BroadcastChannel | undefined = undefined;

    const createChannel = () => {
      currentChannel = new BroadcastChannel(name, {
        webWorkerSupport: true,
        idb: {
          onclose: () => {
            // the onclose event is just the IndexedDB closing.
            // you should also close the channel before creating
            // a new one.
            void currentChannel?.close();
            createChannel();
          },
        },
      });

      sub.next(currentChannel);
    };

    createChannel();

    return () => {
      void currentChannel?.close();
    };
  }).pipe(
    share({
      connector: () => new ReplaySubject(1),
    }),
    takeUntil(stop$)
  );
};

export const chunk = <T>(array: Array<T>, chunkSize: number): T[][] =>
  Array(Math.ceil(array.length / chunkSize))
    .fill(null)
    .map((_, index) => index * chunkSize)
    .map((begin) => array.slice(begin, begin + chunkSize));

export const notifyTablesContentChanged = async (
  state: IDbState,
  tables: string[]
) => {
  return lastValueFrom(
    state.sharedState.eventsCh$.pipe(
      first(),
      switchMap(async (ch) => {
        await ch.postMessage(tables);
      })
    )
  );
};
