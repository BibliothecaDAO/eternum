export interface ClientLogger {
  warn(message: string, details?: unknown): void;
}

export interface EternumClientConfig {
  toriiUrl: string;
  cacheUrl?: string;
  logger?: ClientLogger;
}
