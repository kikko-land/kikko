// Adopted from https://github.com/ai/nanoevents/blob/main/index.js

// Adopted from https://github.com/ai/nanoevents
// I didn't use original due to lack of cjs support

export type EventsMap = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [eventName: string]: (...args: any[]) => Promise<void> | void;
};

export interface INanoEmitter<Events extends EventsMap> {
  emit<K extends keyof Events>(
    event: K,
    ...args: Parameters<Events[K]>
  ): Promise<void>;

  on<K extends keyof Events>(event: K, cb: Events[K]): () => void;
}

export function createNanoEvents<
  Events extends EventsMap
>(): INanoEmitter<Events> {
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
