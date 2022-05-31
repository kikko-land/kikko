import { BroadcastChannel } from "broadcast-channel";
import { Observable, ReplaySubject, share, takeUntil } from "rxjs";

export type IMessage = { changesInTables: string[] };
export type IListener = (msg: IMessage) => void;
export interface INotifyChannel {
  postMessage(msg: IMessage): Promise<void>;
  addEventListener(cb: IListener): void;
  removeEventListener(cb: IListener): void;
  close(): Promise<void>;
}
export const getBroadcastCh$ = (name: string, stop$: Observable<void>) => {
  return new Observable<INotifyChannel>((sub) => {
    let currentChannel: INotifyChannel | undefined = undefined;

    const createChannel = () => {
      const channel = new BroadcastChannel(name, {
        type: "localstorage",
        webWorkerSupport: false,
        // idb: {
        //   onclose: () => {
        //     // the onclose event is just the IndexedDB closing.
        //     // you should also close the channel before creating
        //     // a new one.
        //     void currentChannel?.close();
        //     createChannel();
        //   },
        // },
      });

      let listeners: IListener[] = [];

      const ch: INotifyChannel = {
        async postMessage(data) {
          listeners.forEach((l) => {
            l(data);
          });

          return channel.postMessage(data);
        },
        addEventListener(cb) {
          listeners.push(cb);

          return channel.addEventListener("message", cb);
        },
        removeEventListener(cb) {
          listeners = listeners.filter((l) => l !== cb);

          return channel.removeEventListener("message", cb);
        },
        close() {
          listeners = [];
          return channel.close();
        },
      };

      currentChannel = ch;

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
