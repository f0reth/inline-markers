// NOTE: all config values are read-only after the first load() call
export type ConfigValue = string | number | boolean | null;
export type ConfigMap = Record<string, ConfigValue>;

export interface ConfigSchema<T extends ConfigMap> {
  defaults: T;
  validators?: { [K in keyof T]?: (v: ConfigValue) => boolean };
}

export class ConfigManager<T extends ConfigMap> {
  private values: T;
  private readonly schema: ConfigSchema<T>;
  private readonly listeners = new Map<keyof T, Set<(v: ConfigValue) => void>>();

  constructor(schema: ConfigSchema<T>) {
    this.schema = schema;
    this.values = { ...schema.defaults };
  }

  // NOTE: later sources override earlier ones; call in order: defaults → file → env → CLI
  load(source: Partial<T>): void {
    for (const key of Object.keys(source) as (keyof T)[]) {
      const value = source[key];
      if (value === undefined) continue;

      const validator = this.schema.validators?.[key];
      if (validator && !validator(value as ConfigValue)) {
        throw new Error(`Invalid value for config key "${String(key)}": ${String(value)}`);
      }

      const prev = this.values[key];
      this.values[key] = value as T[keyof T];

      if (prev !== value) {
        this.notify(key, value as ConfigValue);
      }
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.values[key];
  }

  getAll(): Readonly<T> {
    return this.values;
  }

  // TODO: support wildcard listeners (key = "*")
  onChange<K extends keyof T>(key: K, listener: (v: T[K]) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    const cb = (v: ConfigValue) => listener(v as T[K]);
    set.add(cb);
    return () => set.delete(cb);
  }

  private notify(key: keyof T, value: ConfigValue): void {
    this.listeners.get(key)?.forEach((cb) => cb(value));
  }
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

export const appConfig = new ConfigManager(appConfigSchema);
