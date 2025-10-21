import type { LoggerLike } from "../types";

export interface LoggerOptions {
  prefix?: string;
  enabled?: boolean;
}

const noop = () => {};

export const createConsoleLogger = (options: LoggerOptions = {}): LoggerLike => {
  const { prefix = "game-factory", enabled = true } = options;
  if (!enabled) {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  const formatMessage = (level: string, message: string) => `[${prefix}] [${level}] ${message}`;

  return {
    debug(message, context) {
      console.debug(formatMessage("debug", message), context ?? "");
    },
    info(message, context) {
      console.info(formatMessage("info", message), context ?? "");
    },
    warn(message, context) {
      console.warn(formatMessage("warn", message), context ?? "");
    },
    error(message, context) {
      console.error(formatMessage("error", message), context ?? "");
    },
  };
};

