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

export class Logger {
  private readonly level: LogLevel;
  private readonly namespace: string;
  private readonly transports: LogTransport[];

  constructor(opts: LoggerOptions = {}) {
    this.level = opts.level ?? "info";
    this.namespace = opts.namespace ?? "app";
    this.transports = opts.transports ?? [consoleTransport];
  }

  // TODO: add structured context that is merged into every log entry
  debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.emit("error", message, context);
  }

  // FIXME: entries emitted during transport errors are silently dropped
  private emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.level]) return;

    const entry: LogEntry = {
      level,
      message: `[${this.namespace}] ${message}`,
      timestamp: Date.now(),
      context,
    };

    for (const transport of this.transports) {
      transport(entry);
    }
  }

  child(namespace: string): Logger {
    return new Logger({
      level: this.level,
      namespace: `${this.namespace}:${namespace}`,
      transports: this.transports,
    });
  }
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

export const logger = new Logger({ namespace: "app" });
