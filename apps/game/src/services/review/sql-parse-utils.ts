import { RESOURCE_PRECISION } from "@bibliothecadao/types";

const RESOURCE_PRECISION_BIGINT = BigInt(RESOURCE_PRECISION);

const parseBigIntValue = (value: unknown): bigint | null => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        return BigInt(trimmed);
      }

      if (/^[+-]?\d+$/.test(trimmed)) {
        return BigInt(trimmed);
      }
    } catch {
      return null;
    }
  }

  return null;
};

const parseInteger = (value: unknown): number | null => {
  const bigintValue = parseBigIntValue(value);
  if (bigintValue == null) {
    return null;
  }

  const asNumber = Number(bigintValue);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const parseNumeric = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    try {
      const parsed = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? Number(BigInt(trimmed)) : Number(trimmed);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  return 0;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  if (typeof value === "bigint") {
    return value !== 0n;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return false;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return parseNumeric(trimmed) !== 0;
  }

  return false;
};

const parseScaledAmount = (value: unknown): number => {
  const bigintValue = parseBigIntValue(value);
  if (bigintValue != null) {
    const whole = bigintValue / RESOURCE_PRECISION_BIGINT;
    const remainder = bigintValue % RESOURCE_PRECISION_BIGINT;
    const wholeAsNumber = Number(whole);
    const remainderAsNumber = Number(remainder) / RESOURCE_PRECISION;

    const combined = wholeAsNumber + remainderAsNumber;
    if (Number.isFinite(combined)) {
      return combined;
    }
  }

  return parseNumeric(value) / RESOURCE_PRECISION;
};

const parseTroopTier = (value: unknown, usesZeroBasedEncoding: boolean): 1 | 2 | 3 | null => {
  if (value == null) return null;

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1) {
      return parseTroopTier(entries[0][0], usesZeroBasedEncoding);
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = trimmed.toUpperCase();
    if (normalized === "T1") return 1;
    if (normalized === "T2") return 2;
    if (normalized === "T3") return 3;

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return parseTroopTier(JSON.parse(trimmed), usesZeroBasedEncoding);
      } catch {
        return null;
      }
    }
  }

  const numericTier = parseInteger(value);
  if (numericTier == null) {
    return null;
  }

  if (usesZeroBasedEncoding) {
    if (numericTier === 0) return 1;
    if (numericTier === 1) return 2;
    if (numericTier === 2) return 3;
    return null;
  }

  if (numericTier === 1 || numericTier === 2 || numericTier === 3) {
    return numericTier;
  }

  return null;
};

const parseAddress = (value: unknown): string | null => {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const asHex = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed : `0x${trimmed}`;
      return `0x${BigInt(asHex).toString(16)}`.toLowerCase();
    } catch {
      return null;
    }
  }

  if (typeof value === "number" || typeof value === "bigint") {
    try {
      return `0x${BigInt(value).toString(16)}`.toLowerCase();
    } catch {
      return null;
    }
  }

  return null;
};

export const normalizeNonZeroAddress = (value: unknown): string | null => {
  const address = parseAddress(value);
  if (!address) {
    return null;
  }

  try {
    return BigInt(address) === 0n ? null : address;
  } catch {
    return null;
  }
};
