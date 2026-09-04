const DYNAMIC_IMPORT_RELOAD_STORAGE_KEY = "eternum:last-dynamic-import-reload";
const DYNAMIC_IMPORT_RELOAD_COOLDOWN_MS = 30_000;

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load module script/i,
  /loading chunk [\w-]+ failed/i,
];

type StorageLike = Pick<Storage, "getItem" | "setItem">;

let inMemoryLastReloadAttemptMs = 0;

const parseTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const readLastReloadAttempt = (storage: StorageLike): number => {
  try {
    const stored = parseTimestamp(storage.getItem(DYNAMIC_IMPORT_RELOAD_STORAGE_KEY));
    if (stored === null) return inMemoryLastReloadAttemptMs;
    return Math.max(stored, inMemoryLastReloadAttemptMs);
  } catch {
    return inMemoryLastReloadAttemptMs;
  }
};

const writeLastReloadAttempt = (storage: StorageLike, nowMs: number): boolean => {
  inMemoryLastReloadAttemptMs = nowMs;
  try {
    storage.setItem(DYNAMIC_IMPORT_RELOAD_STORAGE_KEY, String(nowMs));
    return true;
  } catch {
    return false;
  }
};

const buildErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    if (typeof cause === "string") return `${error.message} ${cause}`;
    if (cause instanceof Error) return `${error.message} ${cause.message}`;
    return error.message;
  }
  return String(error ?? "");
};

export const isDynamicImportChunkError = (error: unknown): boolean => {
  if (error instanceof Error && error.name === "ChunkLoadError") {
    return true;
  }
  const message = buildErrorMessage(error);
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

export const shouldAttemptDynamicImportRecovery = (
  storage: StorageLike | null | undefined,
  nowMs: number = Date.now(),
  cooldownMs: number = DYNAMIC_IMPORT_RELOAD_COOLDOWN_MS,
): boolean => {
  // Avoid automatic reload loops when storage is unavailable.
  if (!storage) {
    return false;
  }

  const lastAttemptMs = readLastReloadAttempt(storage);
  if (lastAttemptMs > 0 && nowMs - lastAttemptMs < cooldownMs) {
    return false;
  }
  return writeLastReloadAttempt(storage, nowMs);
};
