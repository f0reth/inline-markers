export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export type LogTransport = (entry: LogEntry) => void;

export const consoleTransport: LogTransport = (entry) => {
  const ts = new Date(entry.timestamp).toISOString();
  const msg = `${ts} [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.level === "error") {
    console.error(msg, entry.context ?? "");
  } else if (entry.level === "warn") {
    console.warn(msg, entry.context ?? "");
  } else {
    console.log(msg, entry.context ?? "");
  }
};

export interface LoggerOptions {
  level?: LogLevel;
  namespace?: string;
  transports?: LogTransport[];
}

export type Logger = {
  // TODO: add structured context that is merged into every log entry
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(namespace: string): Logger;
};

export function createLogger(opts: LoggerOptions = {}): Logger {
  const level = opts.level ?? "info";
  const namespace = opts.namespace ?? "app";
  const transports = opts.transports ?? [consoleTransport];

  // FIXME: entries emitted during transport errors are silently dropped
  function emit(logLevel: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_RANK[logLevel] < LEVEL_RANK[level]) return;

    const entry: LogEntry = {
      level: logLevel,
      message: `[${namespace}] ${message}`,
      timestamp: Date.now(),
      context,
    };

    for (const transport of transports) {
      transport(entry);
    }
  }

  return {
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context),
    child: (childNamespace) =>
      createLogger({ level, namespace: `${namespace}:${childNamespace}`, transports }),
  };
}

// TODO: flush buffered entries before process exits
export function createBufferedTransport(maxEntries = 500): {
  transport: LogTransport;
  flush: () => LogEntry[];
} {
  const buffer: LogEntry[] = [];
  return {
    transport: (entry) => {
      if (buffer.length >= maxEntries) {
        buffer.shift();
      }
      buffer.push(entry);
    },
    flush: () => buffer.splice(0),
  };
}

export const logger = createLogger({ namespace: "app" });
