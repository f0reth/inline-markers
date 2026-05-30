// NOTE: all config values are read-only after the first load() call
export type ConfigValue = string | number | boolean | null;
export type ConfigMap = Record<string, ConfigValue>;

export interface ConfigSchema<T extends ConfigMap> {
  defaults: T;
  validators?: { [K in keyof T]?: (v: ConfigValue) => boolean };
}

export type ConfigManager<T extends ConfigMap> = {
  // NOTE: later sources override earlier ones; call in order: defaults → file → env → CLI
  load(source: Partial<T>): void;
  get<K extends keyof T>(key: K): T[K];
  getAll(): Readonly<T>;
  // TODO: support wildcard listeners (key = "*")
  onChange<K extends keyof T>(key: K, listener: (v: T[K]) => void): () => void;
};

export function createConfigManager<T extends ConfigMap>(
  schema: ConfigSchema<T>,
): ConfigManager<T> {
  const values: T = { ...schema.defaults };
  const listeners = new Map<keyof T, Set<(v: ConfigValue) => void>>();

  function notify(key: keyof T, value: ConfigValue): void {
    listeners.get(key)?.forEach((cb) => cb(value));
  }

  function load(source: Partial<T>): void {
    for (const key of Object.keys(source) as (keyof T)[]) {
      const value = source[key];
      if (value === undefined) continue;

      const validator = schema.validators?.[key];
      if (validator && !validator(value)) {
        throw new Error(`Invalid value for config key "${String(key)}": ${String(value)}`);
      }

      const prev = values[key];
      values[key] = value as T[keyof T];

      if (prev !== value) {
        notify(key, value);
      }
    }
  }

  function get<K extends keyof T>(key: K): T[K] {
    return values[key];
  }

  function getAll(): Readonly<T> {
    return values;
  }

  function onChange<K extends keyof T>(key: K, listener: (v: T[K]) => void): () => void {
    if (!listeners.has(key)) {
      listeners.set(key, new Set());
    }
    const set = listeners.get(key)!;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const cb = (v: ConfigValue) => listener(v as T[K]);
    set.add(cb);
    return () => set.delete(cb);
  }

  return { load, get, getAll, onChange };
}

export interface AppConfig extends ConfigMap {
  debug: boolean;
  logLevel: string;
  maxRetries: number;
  requestTimeout: number;
  apiBaseUrl: string;
  apiKey: string;
  cacheEnabled: boolean;
  cacheTtl: number;
  maxCacheSize: number;
  featureNewDashboard: boolean;
}

// TODO: load from environment variables in a separate module
export const appConfigSchema: ConfigSchema<AppConfig> = {
  defaults: {
    debug: false,
    logLevel: "info",
    maxRetries: 3,
    requestTimeout: 30000,
    apiBaseUrl: "https://api.example.com",
    apiKey: "",
    cacheEnabled: true,
    cacheTtl: 60000,
    maxCacheSize: 500,
    featureNewDashboard: false,
  },
  validators: {
    maxRetries: (v) => typeof v === "number" && v >= 0 && v <= 10,
    requestTimeout: (v) => typeof v === "number" && v > 0,
    logLevel: (v) => typeof v === "string" && ["debug", "info", "warn", "error"].includes(v),
    cacheTtl: (v) => typeof v === "number" && v >= 0,
    maxCacheSize: (v) => typeof v === "number" && v > 0,
  },
};

export const appConfig = createConfigManager(appConfigSchema);
