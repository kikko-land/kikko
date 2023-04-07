import { deepEqual } from "fast-equals";

export interface ReactiveVar<T> {
  __state: {
    subscriptions: ((val: T) => void)[];
    value: T;
    isStopped: boolean;
    onStop: (() => void)[];
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
  isStopped: boolean;
  stop(): void;
}

export class TimeoutError extends Error {}
export class StoppedError extends Error {}

const startTimeoutChecker = (() => {
  const timeoutMap = new Map<() => void, number>();

  let isLoopRunning = false;
  let stopLoopAfter: number | undefined;

  const startLoopIfPossible = async () => {
    if (isLoopRunning) return;
    isLoopRunning = true;

    while (isLoopRunning) {
      if (timeoutMap.size === 0) {
        if (!stopLoopAfter) {
          stopLoopAfter = Date.now() + 10_000;
        } else if (stopLoopAfter < Date.now()) {
          isLoopRunning = false;
          stopLoopAfter = undefined;
          break;
        }
      } else {
        stopLoopAfter = undefined;

        for (const [toCall, callAfter] of timeoutMap.entries()) {
          if (callAfter < Date.now()) {
            toCall();

            timeoutMap.delete(toCall);
          }
        }
      }

      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 1_000);
      });
    }
  };

  return (toCall: () => void, after: number) => {
    timeoutMap.set(toCall, Date.now() + after);
    void startLoopIfPossible();

    return () => {
      timeoutMap.delete(toCall);
    };
  };
})();

export const reactiveVar = <T>(
  val: T,
  rOpts: { label: string; deduplicate?: boolean }
): ReactiveVar<T> => {
  const shouldDeduplicate =
    rOpts.deduplicate === undefined ? true : rOpts.deduplicate;

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
      if (this.isStopped)
        throw new Error(`reactiveVar ${rOpts.label} is stopped!`);

      if (shouldDeduplicate && deepEqual(this.__state.value, val)) {
        return;
      }

      this.__state.value = val;

      for (const sub of this.__state.subscriptions) {
        sub(val);
      }
    },
    get value() {
      if (this.isStopped)
        throw new Error(`reactiveVar ${rOpts.label} is stopped!`);

      return this.__state.value;
    },
    subscribe(
      func: (val: T) => void | (() => void),
      emitValueOnSubscribe = true
    ) {
      if (this.isStopped)
        throw new Error(`reactiveVar ${rOpts.label} is stopped!`);

      let currentUnsubscribe: undefined | void | (() => void);

      const subscriber = (val: T) => {
        if (currentUnsubscribe) {
          currentUnsubscribe();
        }
        currentUnsubscribe = func(val);
      };

      this.__state.subscriptions.push(subscriber);

      if (emitValueOnSubscribe) {
        subscriber(this.__state.value);
      }

      return () => {
        this.__state.subscriptions = this.__state.subscriptions.filter((s) => {
          return s !== subscriber;
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
      const stopError = new StoppedError(
        `waitUntil for reactiveVar ${rOpts.label} is stopped due to stop signal`
      );
      const timeoutError = new TimeoutError(
        `waitUntil for reactiveVar ${rOpts.label} is timed out`
      );
      const stoppedError = new StoppedError(
        `waitUntil for reactiveVar ${rOpts.label} is stopped due to reactive var stop`
      );

      if (this.isStopped)
        throw new Error(`reactiveVar ${rOpts.label} is stopped!`);

      if (filter(this.value)) return Promise.resolve();

      const toWait = new Promise<void>((resolve, reject) => {
        let isUnsubscribed = false;
        let unsubscriptions: (() => void)[] = [];

        const unsubAll = () => {
          if (isUnsubscribed) return;
          for (const unsub of unsubscriptions) {
            unsub();
          }

          isUnsubscribed = true;
          unsubscriptions = [];
        };

        const addUnsub = (unsub: () => void) => {
          if (isUnsubscribed) {
            unsub();
          } else {
            unsubscriptions.push(unsub);
          }
        };

        if (!isUnsubscribed) {
          addUnsub(
            this.subscribe((newVal) => {
              if (!filter(newVal)) return;

              unsubAll();

              resolve();
            }, true)
          );
        }

        if (!isUnsubscribed) {
          addUnsub(
            opts?.stopIf?.subscribe((newVal) => {
              if (!newVal) return;

              unsubAll();

              reject(stopError);
            }, true) ||
              (() => {
                return undefined;
              })
          );
        }

        if (!isUnsubscribed) {
          if (
            opts?.timeout === undefined ||
            typeof opts?.timeout === "number"
          ) {
            const unsub = startTimeoutChecker(
              () => {
                unsubAll();

                reject(timeoutError);
              },
              opts?.timeout === undefined ? 120_000 : opts.timeout
            );

            addUnsub(() => {
              unsub();
            });
          }
        }

        if (!isUnsubscribed) {
          const onStopHandler = () => {
            unsubAll();

            reject(stoppedError);
          };

          this.__state.onStop.push(onStopHandler);

          addUnsub(() => {
            this.__state.onStop = this.__state.onStop.filter((s) => {
              return s !== onStopHandler;
            });
          });
        }
      });

      return toWait;
    },
    stop() {
      if (this.isStopped)
        throw new Error(`reactiveVar ${rOpts.label} is already stopped!`);

      this.__state.subscriptions = [];

      for (const unsub of this.__state.onStop) {
        unsub();
      }

      this.__state.onStop = [];

      this.__state.isStopped = true;
    },
  };
};
