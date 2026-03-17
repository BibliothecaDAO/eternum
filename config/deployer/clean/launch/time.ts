const SECONDS_LENGTH = 10;
const MILLISECONDS_LENGTH = 13;

export function parseStartTime(input: string | number): number {
  if (typeof input === "number") {
    return normalizeEpoch(input);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Game start time is required");
  }

  if (/^\d+$/.test(trimmed)) {
    return normalizeEpoch(Number(trimmed));
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid game start time "${input}". Use unix seconds, unix milliseconds, or ISO-8601.`);
  }

  return Math.floor(parsed / 1000);
}

export function toIsoUtc(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString();
}

function normalizeEpoch(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid epoch value "${value}"`);
  }

  const digits = Math.trunc(value).toString().length;
  if (digits >= MILLISECONDS_LENGTH) {
    return Math.floor(value / 1000);
  }

  if (digits < SECONDS_LENGTH) {
    throw new Error(`Epoch "${value}" is too short to be a valid unix timestamp`);
  }

  return Math.trunc(value);
}
