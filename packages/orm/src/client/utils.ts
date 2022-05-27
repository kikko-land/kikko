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

export interface INotifyChannel {
  postMessage(tables: string[]): Promise<void>;
  addEventListener(cb: (data: string[]) => void): void;
  removeEventListener(cb: (data: string[]) => void): void;
  close(): Promise<void>;
}

export const getBroadcastCh$ = (name: string, stop$: Observable<void>) => {
  return new Observable<INotifyChannel>((sub) => {
    let currentChannel: INotifyChannel | undefined = undefined;

    const createChannel = () => {
      const channel = new BroadcastChannel(name, {
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

      let listeners: ((data: string[]) => void)[] = [];

      currentChannel = {
        async postMessage(data: string[]) {
          listeners.forEach((l) => {
            l(data);
          });

          return channel.postMessage(data);
        },
        addEventListener(cb: (data: string[]) => void) {
          listeners.push(cb);

          return channel.addEventListener("message", cb);
        },
        removeEventListener(cb: (data: string[]) => void) {
          listeners = listeners.filter((l) => l !== cb);

          return channel.removeEventListener("message", cb);
        },
        close() {
          listeners = [];
          return channel.close();
        },
      };

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
  if (tables.length === 0) return;

  return lastValueFrom(
    state.sharedState.eventsCh$.pipe(
      first(),
      switchMap(async (ch) => {
        await ch.postMessage(tables);
      })
    )
  );
};
