export interface CacheEntry<V> {
  value: V;
  expiresAt: number | null;
  hits: number;
}

export interface CacheOptions {
  maxSize?: number;
  ttl?: number;
}

// HACK: uses a plain Map; should switch to a proper LRU structure for large caches
export class MemoryCache<K, V> {
  private store = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number | null;

  constructor(opts: CacheOptions = {}) {
    this.maxSize = opts.maxSize ?? 1000;
    this.defaultTtl = opts.ttl ?? null;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    entry.hits++;
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    // TODO: evict least-recently-used entry instead of oldest when at capacity
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    const effectiveTtl = ttl ?? this.defaultTtl;
    this.store.set(key, {
      value,
      expiresAt: effectiveTtl !== null ? Date.now() + effectiveTtl : null,
      hits: 0,
    });
  }

  has(key: K): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  // TODO: add stats() method to expose hit/miss ratio
  keys(): IterableIterator<K> {
    return this.store.keys();
  }

  values(): V[] {
    return [...this.store.values()].map((e) => e.value);
  }

  entries(): [K, V][] {
    return [...this.store.entries()].map(([k, e]) => [k, e.value]);
  }
}

export class AsyncCache<K, V> {
  private cache: MemoryCache<K, V>;
  private inflight = new Map<K, Promise<V>>();

  constructor(opts: CacheOptions = {}) {
    this.cache = new MemoryCache<K, V>(opts);
  }

  async getOrFetch(key: K, fetcher: () => Promise<V>, ttl?: number): Promise<V> {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    // HACK: concurrent requests for the same key share a single in-flight promise
    const promise = fetcher().then((value) => {
      this.cache.set(key, value, ttl);
      this.inflight.delete(key);
      return value;
    });
    this.inflight.set(key, promise);
    return promise;
  }

  invalidate(key: K): void {
    this.cache.delete(key);
    this.inflight.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }
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
