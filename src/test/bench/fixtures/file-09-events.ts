export type EventMap = Record<string, unknown[]>;

export type EventListener<T extends unknown[]> = (...args: T) => void | Promise<void>;

export interface EventEmitterOptions {
  maxListeners?: number;
}

export class EventEmitter<Events extends EventMap> {
  private readonly listeners = new Map<keyof Events, Set<EventListener<Events[keyof Events]>>>();
  private readonly onceSet = new WeakSet<EventListener<Events[keyof Events]>>();
  private readonly maxListeners: number;

  constructor(opts: EventEmitterOptions = {}) {
    this.maxListeners = opts.maxListeners ?? 100;
  }

  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    if (set.size >= this.maxListeners) {
      // FIXME: should throw instead of silently dropping the listener
      console.warn(
        `[EventEmitter] maxListeners (${this.maxListeners}) reached for event "${String(event)}"`,
      );
      return this;
    }
    set.add(listener as EventListener<Events[keyof Events]>);
    return this;
  }

  once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    this.onceSet.add(listener as EventListener<Events[keyof Events]>);
    return this.on(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): this {
    this.listeners.get(event)?.delete(listener as EventListener<Events[keyof Events]>);
    return this;
  }

  // FIXME: async listeners are not awaited — errors in async listeners are unhandled
  emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;

    const toRemove: EventListener<Events[keyof Events]>[] = [];
    for (const listener of set) {
      void listener(...(args as Events[keyof Events]));
      if (this.onceSet.has(listener)) {
        toRemove.push(listener);
      }
    }
    for (const listener of toRemove) {
      set.delete(listener);
      this.onceSet.delete(listener);
    }
    return true;
  }

  async emitAsync<K extends keyof Events>(event: K, ...args: Events[K]): Promise<boolean> {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;

    const toRemove: EventListener<Events[keyof Events]>[] = [];
    for (const listener of set) {
      await listener(...(args as Events[keyof Events]));
      if (this.onceSet.has(listener)) {
        toRemove.push(listener);
      }
    }
    for (const listener of toRemove) {
      set.delete(listener);
      this.onceSet.delete(listener);
    }
    return true;
  }

  removeAllListeners(event?: keyof Events): this {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export interface AppEvents extends EventMap {
  ready: [];
  error: [error: Error];
  configChanged: [key: string, value: unknown];
  userLoggedIn: [userId: string];
  userLoggedOut: [userId: string];
}

export const appEvents = new EventEmitter<AppEvents>({ maxListeners: 200 });
