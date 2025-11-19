type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: number;

  constructor() {
    // In production, default to 'warn' or 'error'. In dev, 'info' or 'debug'.
    // We can control this via env vars if needed.
    const configuredLevel = import.meta.env.DEV ? "debug" : "warn";
    this.minLevel = LOG_LEVEL_PRIORITY[configuredLevel];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.minLevel;
  }

  debug(...args: any[]) {
    if (this.shouldLog("debug")) {
      console.debug(...args);
    }
  }

  log(...args: any[]) {
    if (this.shouldLog("info")) {
      console.log(...args);
    }
  }

  info(...args: any[]) {
    if (this.shouldLog("info")) {
      console.info(...args);
    }
  }

  warn(...args: any[]) {
    if (this.shouldLog("warn")) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    if (this.shouldLog("error")) {
      console.error(...args);
    }
  }
}

export const logger = new Logger();
