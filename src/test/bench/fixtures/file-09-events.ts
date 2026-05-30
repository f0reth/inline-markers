export type EventMap = Record<string, unknown[]>;

export type EventListener<T extends unknown[]> = (...args: T) => void | Promise<void>;

export interface EventEmitterOptions {
  maxListeners?: number;
}

export type EventEmitter<Events extends EventMap> = {
  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): EventEmitter<Events>;
  once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): EventEmitter<Events>;
  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): EventEmitter<Events>;
  // FIXME: async listeners are not awaited — errors in async listeners are unhandled
  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean;
  emitAsync<K extends keyof Events>(event: K, ...args: Events[K]): Promise<boolean>;
  removeAllListeners(event?: keyof Events): EventEmitter<Events>;
  listenerCount(event: keyof Events): number;
};

export function createEventEmitter<Events extends EventMap>(
  opts: EventEmitterOptions = {},
): EventEmitter<Events> {
  const listeners = new Map<keyof Events, Set<EventListener<Events[keyof Events]>>>();
  const onceSet = new WeakSet<EventListener<Events[keyof Events]>>();
  const maxListeners = opts.maxListeners ?? 100;

  const self: EventEmitter<Events> = {
    on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): EventEmitter<Events> {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      const set = listeners.get(event)!;
      if (set.size >= maxListeners) {
        // FIXME: should throw instead of silently dropping the listener
        console.warn(
          `[EventEmitter] maxListeners (${maxListeners}) reached for event "${String(event)}"`,
        );
        return self;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      set.add(listener as EventListener<Events[keyof Events]>);
      return self;
    },

    once<K extends keyof Events>(
      event: K,
      listener: EventListener<Events[K]>,
    ): EventEmitter<Events> {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      onceSet.add(listener as EventListener<Events[keyof Events]>);
      return self.on(event, listener);
    },

    off<K extends keyof Events>(
      event: K,
      listener: EventListener<Events[K]>,
    ): EventEmitter<Events> {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      listeners.get(event)?.delete(listener as EventListener<Events[keyof Events]>);
      return self;
    },

    emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
      const set = listeners.get(event);
      if (!set || set.size === 0) return false;

      const toRemove: EventListener<Events[keyof Events]>[] = [];
      for (const listener of set) {
        void listener(...(args as Events[keyof Events]));
        if (onceSet.has(listener)) {
          toRemove.push(listener);
        }
      }
      for (const listener of toRemove) {
        set.delete(listener);
        onceSet.delete(listener);
      }
      return true;
    },

    async emitAsync<K extends keyof Events>(event: K, ...args: Events[K]): Promise<boolean> {
      const set = listeners.get(event);
      if (!set || set.size === 0) return false;

      const toRemove: EventListener<Events[keyof Events]>[] = [];
      for (const listener of set) {
        await listener(...(args as Events[keyof Events]));
        if (onceSet.has(listener)) {
          toRemove.push(listener);
        }
      }
      for (const listener of toRemove) {
        set.delete(listener);
        onceSet.delete(listener);
      }
      return true;
    },

    removeAllListeners(event?: keyof Events): EventEmitter<Events> {
      if (event !== undefined) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
      return self;
    },

    listenerCount(event: keyof Events): number {
      return listeners.get(event)?.size ?? 0;
    },
  };

  return self;
}

export interface AppEvents extends EventMap {
  ready: [];
  error: [error: Error];
  configChanged: [key: string, value: unknown];
  userLoggedIn: [userId: string];
  userLoggedOut: [userId: string];
}

export const appEvents = createEventEmitter<AppEvents>({ maxListeners: 200 });
