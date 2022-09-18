// Adopted from https://github.com/ai/nanoevents/blob/main/index.js

// Adopted from https://github.com/ai/nanoevents
// I didn't use original due to lack of cjs support

export type EventsMap = {
  [eventName: string]: (...args: any[]) => Promise<void> | void;
};
export function createNanoEvents<Events extends EventsMap>() {
  const events: Partial<{ [E in keyof Events]: Events[E][] }> = {};

  return {
    async emit<K extends keyof Events>(
      event: K,
      ...args: Parameters<Events[K]>
    ) {
      const all: Array<Events[K]> = events[event] || [];
      for (const toCall of all) {
        await toCall(...args);
      }
    },
    on<K extends keyof Events>(event: K, cb: Events[K]): () => void {
      ((events[event] = events[event] || []) as Events[K][]).push(cb);

      return () => {
        const eventsArray: Events[K][] = events[event] || [];

        events[event] = eventsArray.filter((i: unknown) => i !== cb);
      };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type INanoEmitter<E extends EventsMap> = ReturnType<typeof createNanoEvents<E>>;
