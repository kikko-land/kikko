export interface ReactiveVar<T> {
  __state: {
    subscriptions: ((val: T) => void)[];
    value: T;
  };
  value: T;
  subscribe(sub: (val: T) => void, emitValueOnSubscribe?: boolean): () => void;
  waitTill(
    filter: (val: T) => boolean,
    opts?: {
      stopIf?: ReactiveVar<boolean>;
      forcePromiseResolve?: (callback: () => void) => void;
      timeout?: number | "infinite";
    }
  ): Promise<void>;
}

export class TimeoutError extends Error {}

export const reactiveVar = <T>(val: T): ReactiveVar<T> => {
  return {
    __state: {
      subscriptions: [],
      value: val,
    },
    set value(val: T) {
      this.__state.value = val;

      for (const sub of this.__state.subscriptions) {
        sub(val);
      }
    },
    get value() {
      return this.__state.value;
    },
    subscribe(sub: (val: T) => void, emitValueOnSubscribe: boolean = true) {
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
      const toWait = new Promise<void>((resolve, reject) => {
        const unsubscriptions: (() => void)[] = [];

        const unsubAll = () => {
          for (const unsub of unsubscriptions) {
            unsub();
          }
        };

        unsubscriptions.push(
          this.subscribe((newVal) => {
            if (!newVal) return;

            unsubAll();

            resolve();
          }, true)
        );

        unsubscriptions.push(
          this.subscribe((newVal) => {
            if (!filter(newVal)) return;

            unsubAll();

            resolve();
          }, true)
        );

        if (opts?.timeout !== undefined && opts.timeout !== "infinite") {
          const id = setTimeout(() => {
            unsubAll();

            reject(new TimeoutError());
          }, opts.timeout);

          unsubscriptions.push(() => {
            clearTimeout(id);
          });
        }
      });

      return toWait;
    },
  };
};
