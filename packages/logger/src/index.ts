export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerConfig {
  moduleName: string;
  enabled?: boolean;
  logLevel?: LogLevel;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type LogHandler = (level: LogLevel, moduleName: string, message: string, ...args: any[]) => void;

class GlobalLogManager {
  private handlers: LogHandler[] = [];

  addHandler(handler: LogHandler) {
    this.handlers.push(handler);
  }

  removeHandler(handler: LogHandler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  dispatch(level: LogLevel, moduleName: string, message: string, ...args: any[]) {
    this.handlers.forEach((handler) => handler(level, moduleName, message, ...args));
  }
}

export const globalLogManager = new GlobalLogManager();

// Add default console handler
globalLogManager.addHandler((level, moduleName, message, ...args) => {
  const formattedMessage = `[${moduleName}] ${message}`;
  switch (level) {
    case "debug":
      console.debug(formattedMessage, ...args);
      break;
    case "info":
      console.info(formattedMessage, ...args);
      break;
    case "warn":
      console.warn(formattedMessage, ...args);
      break;
    case "error":
      console.error(formattedMessage, ...args);
      break;
  }
});

export class Logger {
  private moduleName: string;
  private enabled: boolean;
  private logLevel: LogLevel;

  constructor(config: LoggerConfig | string) {
    if (typeof config === "string") {
      this.moduleName = config;
      this.enabled = true;
      this.logLevel = "info";
    } else {
      this.moduleName = config.moduleName;
      this.enabled = config.enabled ?? true;
      this.logLevel = config.logLevel ?? "info";
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabled && LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.logLevel];
  }

  debug(message: string, ...args: any[]) {
    if (!this.shouldLog("debug")) return;
    globalLogManager.dispatch("debug", this.moduleName, message, ...args);
  }

  info(message: string, ...args: any[]) {
    if (!this.shouldLog("info")) return;
    globalLogManager.dispatch("info", this.moduleName, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    if (!this.shouldLog("warn")) return;
    globalLogManager.dispatch("warn", this.moduleName, message, ...args);
  }

  error(message: string, ...args: any[]) {
    if (!this.shouldLog("error")) return;
    globalLogManager.dispatch("error", this.moduleName, message, ...args);
  }
}

export const createLogger = (moduleName: string, enabled?: boolean) => new Logger({ moduleName, enabled });

export * from "./glass";
