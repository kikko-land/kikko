import { Observable, ReplaySubject, share, takeUntil } from "rxjs";
import { BroadcastChannel } from "broadcast-channel";

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
