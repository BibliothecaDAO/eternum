export interface SecurityConfig {
  allowedOrigins: ReadonlySet<string>;
  globalConnectionCap: number;
  perPlayerConnectionCap: number;
  maxChannelsPerSocket: number;
  maxMessageBytes: number;
  messagesPerSecond: number;
  messageBurst: number;
}

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const readSecurityConfig = (environment = process.env): SecurityConfig => ({
  allowedOrigins: new Set(
    (environment.CORS_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
  globalConnectionCap: positiveInteger(environment.CHAT_GLOBAL_CONNECTION_CAP, 2_000),
  perPlayerConnectionCap: positiveInteger(environment.CHAT_PLAYER_CONNECTION_CAP, 4),
  maxChannelsPerSocket: positiveInteger(environment.CHAT_MAX_CHANNELS_PER_SOCKET, 8),
  maxMessageBytes: positiveInteger(environment.CHAT_MAX_MESSAGE_BYTES, 8_192),
  messagesPerSecond: positiveInteger(environment.CHAT_MESSAGES_PER_SECOND, 5),
  messageBurst: positiveInteger(environment.CHAT_MESSAGE_BURST, 10),
});

export const isAllowedOrigin = (origin: string | undefined, allowedOrigins: ReadonlySet<string>): boolean =>
  Boolean(origin && allowedOrigins.has(origin));
