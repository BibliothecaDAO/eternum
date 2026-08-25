type SentryEnvironment = Record<string, string | boolean | undefined>;
type SentryEvent = {
  contexts?: unknown;
  extra?: unknown;
  request?: unknown;
  tags?: Record<string, unknown>;
  user?: Record<string, unknown>;
  [key: string]: unknown;
};

interface SentryRuntimeOptions {
  sendDefaultPii: boolean;
  tracesSampleRate: number;
  tracePropagationTargets: Array<string | RegExp>;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  environment: string;
  release: string | undefined;
  txFailuresEnabled: boolean;
  txFailureSampleRate: number;
  txCaptureUserRejections: boolean;
  txWalletIdentity: "hashed" | "raw" | "none";
  beforeSend: (event: any, hint?: any) => any | null;
}

export function resolveSentryRuntimeOptions(env: SentryEnvironment): SentryRuntimeOptions {
  const txFailuresEnabled = readBooleanEnv(env, "VITE_PUBLIC_SENTRY_TX_FAILURES_ENABLED", true);
  return {
    sendDefaultPii: readBooleanEnv(env, "VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII", true),
    tracesSampleRate: readNumberEnv(env, "VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", 1),
    tracePropagationTargets: ["localhost"],
    replaysSessionSampleRate: readNumberEnv(env, "VITE_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE", 0.1),
    replaysOnErrorSampleRate: readNumberEnv(env, "VITE_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE", 1),
    environment:
      readStringEnv(env, "VITE_PUBLIC_SENTRY_ENVIRONMENT") || readStringEnv(env, "VITE_PUBLIC_CHAIN") || "development",
    release: readStringEnv(env, "VITE_PUBLIC_SENTRY_RELEASE") || readStringEnv(env, "VITE_PUBLIC_GAME_VERSION"),
    txFailuresEnabled,
    txFailureSampleRate: readNumberEnv(env, "VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE", 1),
    txCaptureUserRejections: readBooleanEnv(env, "VITE_PUBLIC_SENTRY_TX_CAPTURE_USER_REJECTIONS", false),
    txWalletIdentity: readWalletIdentityEnv(env, "VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY", "hashed"),
    beforeSend: (event) => sanitizeSentryEvent(event, txFailuresEnabled),
  };
}

const MAX_SANITIZE_DEPTH = 4;
const MAX_SANITIZE_KEYS = 20;
const MAX_STRING_LENGTH = 500;
const SENSITIVE_KEY_PATTERN = /account|calldata|private|secret|seed|signer|signature|password|authorization/i;

const sanitizeSentryEvent = (event: SentryEvent, txFailuresEnabled: boolean): SentryEvent | null => {
  if (event.tags?.feature === "transactions" && !txFailuresEnabled) {
    return null;
  }

  return {
    ...event,
    contexts: sanitizeEventValue(event.contexts),
    extra: sanitizeEventValue(event.extra),
    request:
      event.tags?.feature === "transactions" && event.request && typeof event.request === "object"
        ? {
            ...(event.request as Record<string, unknown>),
            data: "[Filtered]",
          }
        : event.request,
    user:
      event.tags?.feature === "transactions" && event.user && typeof event.user === "object"
        ? sanitizeTransactionUser(event.user as Record<string, unknown>)
        : event.user,
  };
};

const sanitizeTransactionUser = (user: Record<string, unknown>): Record<string, unknown> => {
  const { address: _address, email: _email, ip_address: _ipAddress, username: _username, ...safeUser } = user;
  return sanitizeEventValue(safeUser) as Record<string, unknown>;
};

const sanitizeEventValue = (value: unknown, depth = 0): unknown => {
  if (value == null) {
    return value;
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return "[Truncated]";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_SANITIZE_KEYS).map((entry) => sanitizeEventValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    const sanitizedRecord: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value).slice(0, MAX_SANITIZE_KEYS)) {
      sanitizedRecord[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[Filtered]" : sanitizeEventValue(entryValue, depth + 1);
    }
    return sanitizedRecord;
  }

  return String(value);
};

const readBooleanEnv = (env: SentryEnvironment, key: string, fallback: boolean): boolean => {
  const value = env[key];
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return value === "true";
};

const readNumberEnv = (env: SentryEnvironment, key: string, fallback: number): number => {
  const value = env[key];
  if (value == null || value === "") return fallback;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const readStringEnv = (env: SentryEnvironment, key: string): string | undefined => {
  const value = env[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readWalletIdentityEnv = (
  env: SentryEnvironment,
  key: string,
  fallback: "hashed" | "raw" | "none",
): "hashed" | "raw" | "none" => {
  const value = readStringEnv(env, key);
  return value === "raw" || value === "none" || value === "hashed" ? value : fallback;
};
