export interface CacheEntry<V> {
  value: V;
  expiresAt: number | null;
  hits: number;
}

export interface CacheOptions {
  maxSize?: number;
  ttl?: number;
}

export type MemoryCache<K, V> = {
  get(key: K): V | undefined;
  set(key: K, value: V, ttl?: number): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  readonly size: number;
  keys(): IterableIterator<K>;
  values(): V[];
  entries(): [K, V][];
};

// HACK: uses a plain Map; should switch to a proper LRU structure for large caches
export function createMemoryCache<K, V>(opts: CacheOptions = {}): MemoryCache<K, V> {
  const store = new Map<K, CacheEntry<V>>();
  const maxSize = opts.maxSize ?? 1000;
  const defaultTtl = opts.ttl ?? null;

  function get(key: K): V | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }

    entry.hits++;
    return entry.value;
  }

  function set(key: K, value: V, ttl?: number): void {
    // TODO: evict least-recently-used entry instead of oldest when at capacity
    if (store.size >= maxSize) {
      const firstKey = store.keys().next().value;
      if (firstKey !== undefined) {
        store.delete(firstKey);
      }
    }

    const effectiveTtl = ttl ?? defaultTtl;
    store.set(key, {
      value,
      expiresAt: effectiveTtl !== null ? Date.now() + effectiveTtl : null,
      hits: 0,
    });
  }

  function has(key: K): boolean {
    const entry = store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      store.delete(key);
      return false;
    }
    return true;
  }

  return {
    get,
    set,
    has,
    delete: (key: K) => store.delete(key),
    clear: () => store.clear(),
    // TODO: add stats() method to expose hit/miss ratio
    get size() {
      return store.size;
    },
    keys: () => store.keys(),
    values: () => [...store.values()].map((e) => e.value),
    entries: () => [...store.entries()].map(([k, e]) => [k, e.value]),
  };
}

export type AsyncCache<K, V> = {
  getOrFetch(key: K, fetcher: () => Promise<V>, ttl?: number): Promise<V>;
  invalidate(key: K): void;
  clear(): void;
};

export function createAsyncCache<K, V>(opts: CacheOptions = {}): AsyncCache<K, V> {
  const cache = createMemoryCache<K, V>(opts);
  const inflight = new Map<K, Promise<V>>();

  async function getOrFetch(key: K, fetcher: () => Promise<V>, ttl?: number): Promise<V> {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const existing = inflight.get(key);
    if (existing) return existing;

    // HACK: concurrent requests for the same key share a single in-flight promise
    const promise = fetcher().then((value) => {
      cache.set(key, value, ttl);
      inflight.delete(key);
      return value;
    });
    inflight.set(key, promise);
    return promise;
  }

  function invalidate(key: K): void {
    cache.delete(key);
    inflight.delete(key);
  }

  function clear(): void {
    cache.clear();
    inflight.clear();
  }

  return { getOrFetch, invalidate, clear };
}

export function memoize<A extends unknown[], R>(
  fn: (...args: A) => R,
  keyFn: (...args: A) => string = (...args) => JSON.stringify(args),
): (...args: A) => R {
  const cache = new Map<string, R>();
  // TODO: expose a way to invalidate individual memoized results
  return (...args: A): R => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
