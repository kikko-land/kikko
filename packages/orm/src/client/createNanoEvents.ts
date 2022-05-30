// Adopted from https://github.com/ai/nanoevents/blob/main/index.js

interface EventsMap {
  [event: string]: any;
}

interface DefaultEvents extends EventsMap {
  [event: string]: (...args: any) => void | Promise<void>;
}

// Adopted from https://github.com/ai/nanoevents
// I didn't use original due to lack of cjs support

export function createNanoEvents<Events extends EventsMap = DefaultEvents>() {
  const events: Partial<{ [E in keyof Events]: Events[E][] }> = {};

  return {
    async emit<K extends keyof Events>(
      event: K,
      ...args: Parameters<Events[K]>
    ) {
      for (const toCall of (events[event] || []) as Events[K][]) {
        await toCall(...args);
      }
    },
    on<K extends keyof Events>(event: K, cb: Events[K]): () => void {
      ((events[event] = events[event] || []) as Events[K][]).push(cb);

      return () =>
        (events[event] = (events[event] || []) as Events[K][]).filter(
          (i) => i !== cb
        );
    },
  };
}

export type INanoEmitter<T> = ReturnType<typeof createNanoEvents<T>>;
