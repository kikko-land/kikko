// Adopted from https://github.com/ai/nanoevents/blob/main/index.js

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventsMap<K extends keyof any> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in K]: (...args: any[]) => Promise<void> | void;
};

// Adopted from https://github.com/ai/nanoevents
// I didn't use original due to lack of cjs support

export function createNanoEvents<Events extends EventsMap<keyof Events>>() {
  const events: Partial<{ [E in keyof Events]: Events[E][] }> = {};

  return {
    async emit<K extends keyof Events>(
      event: K,
      ...args: Parameters<Events[K]>
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const all = (events[event] || []) as Events[K][];
      for (const toCall of all) {
        await toCall(...args);
      }
    },
    on<K extends keyof Events>(event: K, cb: Events[K]): () => void {
      ((events[event] = events[event] || []) as Events[K][]).push(cb);

      return () => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        events[event] = ((events[event] || []) as Events[K][]).filter(
          (i: unknown) => i !== cb
        ) as Events[K][];
      };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type INanoEmitter<T extends EventsMap<keyof T>> = ReturnType<
  typeof createNanoEvents
>;
