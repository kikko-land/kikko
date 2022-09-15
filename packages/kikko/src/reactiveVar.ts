export interface ReactiveVar<T> {
  __state: {
    subscriptions: ((val: T) => void)[];
    value: T;
  };
  value: T;
  subscribe(sub: (val: T) => void): () => void;
  waitTill(filter: (val: T) => boolean): Promise<void>;
}

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
    subscribe(sub: (val: T) => void) {
      this.__state.subscriptions.push(sub);

      return () => {
        this.__state.subscriptions = this.__state.subscriptions.filter((s) => {
          return s !== sub;
        });
      };
    },
    waitTill(filter: (val: T) => boolean) {
      return new Promise<void>((resolve) => {
        const unsubscribe = this.subscribe((newVal) => {
          if (!filter(newVal)) return;
          resolve();
          unsubscribe();
        });
      });
    },
  };
};
