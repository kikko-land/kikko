export interface ReactiveVar<T> {
  __state: {
    subscriptions: ((val: T) => void)[];
    value: T;
    isStopped: boolean;
    onStop: (() => void)[];
  };
  value: T;
  subscribe(
    sub: (val: T) => void | (() => void),
    emitValueOnSubscribe?: boolean
  ): () => void;
  waitTill(
    filter: (val: T) => boolean,
    opts?: {
      stopIf?: ReactiveVar<boolean>;
      forcePromiseResolve?: (callback: () => void) => void;
      timeout?: number | "infinite";
    }
  ): Promise<void>;
  isStopped: boolean;
  stop(): void;
}

export class TimeoutError extends Error {}
export class StoppedError extends Error {}

export const reactiveVar = <T>(val: T, label: string): ReactiveVar<T> => {
  return {
    __state: {
      subscriptions: [],
      value: val,
      isStopped: false,
      onStop: [],
    },
    get isStopped() {
      return this.__state.isStopped;
    },
    set value(val: T) {
      if (this.isStopped) throw new Error(`reactiveVar ${label} is stopped!`);

      this.__state.value = val;

      for (const sub of this.__state.subscriptions) {
        sub(val);
      }
    },
    get value() {
      if (this.isStopped) throw new Error(`reactiveVar ${label} is stopped!`);

      return this.__state.value;
    },
    subscribe(
      sub: (val: T) => void | (() => void),
      emitValueOnSubscribe: boolean = true
    ) {
      if (this.isStopped) throw new Error(`reactiveVar ${label} is stopped!`);

      this.__state.subscriptions.push(sub);

      if (emitValueOnSubscribe) {
        sub(this.__state.value);
      }

      return () => {
        this.__state.subscriptions = this.__state.subscriptions.filter((s) => {
          return s !== sub;
        });
      };
    },
    waitTill(
      filter: (val: T) => boolean,
      opts: {
        stopIf?: ReactiveVar<boolean>;
        timeout?: number | "infinite";
      }
    ) {
      if (this.isStopped) throw new Error(`reactiveVar ${label} is stopped!`);

      const toWait = new Promise<void>((resolve, reject) => {
        const unsubscriptions: (() => void)[] = [];

        const unsubAll = () => {
          for (const unsub of unsubscriptions) {
            unsub();
          }
        };

        unsubscriptions.push(
          opts?.stopIf?.subscribe((newVal) => {
            if (!newVal) return;

            unsubAll();

            reject(
              new StoppedError(
                `waitUntil for reactiveVar ${label} is stopped due to stop signal`
              )
            );
          }, true) || (() => {})
        );

        unsubscriptions.push(
          this.subscribe((newVal) => {
            if (!filter(newVal)) return;

            unsubAll();

            resolve();
          }, true)
        );

        if (opts?.timeout === undefined || opts?.timeout !== "infinite") {
          const id = setTimeout(
            () => {
              unsubAll();

              reject(
                new TimeoutError(
                  `waitUntil for reactiveVar ${label} is timed out`
                )
              );
            },
            opts?.timeout === undefined ? 5000 : opts.timeout
          );

          unsubscriptions.push(() => {
            clearTimeout(id);
          });
        }

        this.__state.onStop.push(() => {
          unsubAll();

          reject(
            new StoppedError(
              `waitUntil for reactiveVar ${label} is stopped due to reactive var stop`
            )
          );
        });
      });

      return toWait;
    },
    stop() {
      if (this.isStopped)
        throw new Error(`reactiveVar ${label} is already stopped!`);

      this.__state.subscriptions = [];

      for (const unsub of this.__state.onStop) {
        unsub();
      }

      this.__state.isStopped = true;
    },
  };
};
