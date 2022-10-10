import { ReactiveVar, reactiveVar } from "@kikko-land/kikko";

export type IMessage = { changesInTables: string[] };
export type IListener = (msg: IMessage) => void;
export interface INotifyChannel {
  postMessage(msg: IMessage): Promise<void>;
  addEventListener(cb: IListener): void;
  removeEventListener(cb: IListener): void;
  close(): Promise<void>;
}

const createMultiTabChannel = async (
  name: string,
  webMultiTabSupport: boolean
): Promise<INotifyChannel> => {
  const webChannel = await (async () => {
    if (!webMultiTabSupport) return undefined;

    return new (await import("broadcast-channel")).BroadcastChannel(name, {
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
  })();

  let listeners: IListener[] = [];

  return {
    async postMessage(data) {
      listeners.forEach((l) => {
        l(data);
      });

      if (webChannel) {
        await webChannel.postMessage(data);
      }
    },
    addEventListener(cb) {
      listeners.push(cb);

      webChannel?.addEventListener("message", cb);
    },
    removeEventListener(cb) {
      listeners = listeners.filter((l) => l !== cb);

      webChannel?.removeEventListener("message", cb);
    },
    async close() {
      listeners = [];

      if (webChannel) {
        await webChannel.close();
      }
    },
  };
};

export const getBroadcastCh = (
  name: string,
  webMultiTabSupport: boolean,
  rDbState: ReactiveVar<"running" | "stopping" | "stopped">
) => {
  const rCh = reactiveVar<INotifyChannel | undefined>(undefined, {
    label: "notifyChannel",
  });

  let isClosed = false;
  let currentChannel: INotifyChannel | undefined;

  const init = async () => {
    const ch = await createMultiTabChannel(name, webMultiTabSupport);

    if (isClosed) return;

    rCh.value = ch;
  };

  void init();

  void (async () => {
    await rDbState.waitTill((v) => v === "stopping", { timeout: "infinite" });

    isClosed = true;
    void currentChannel?.close();
  })();

  return rCh;
};
