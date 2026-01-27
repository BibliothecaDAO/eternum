import { shortString } from "starknet";

/**
 * Decode a padded felt-hex string into an ASCII short string, stripping null bytes.
 */
export const decodePaddedFeltAscii = (hex: string): string => {
  if (!hex) return "";
  const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (h === "0") return "";

  try {
    const asDec = BigInt(`0x${h}`).toString();
    const decoded = shortString.decodeShortString(asDec);
    if (decoded && decoded.trim().length > 0) return decoded;
  } catch {
    // ignore and fallback to manual decode
  }

  let i = 0;
  while (i + 1 < h.length && h.slice(i, i + 2) === "00") i += 2;
  let out = "";
  for (; i + 1 < h.length; i += 2) {
    const byte = parseInt(h.slice(i, i + 2), 16);
    if (byte === 0) continue;
    out += String.fromCharCode(byte);
  }
  return out;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

/**
 * Pull the felt string stored in a factory row for either `name` or `data.name`.
 */
export const extractNameFelt = (row: Record<string, unknown>): string | null => {
  const direct = row.name ?? row["data.name"];
  if (typeof direct === "string") return direct;

  const data = asRecord(row.data);
  if (data) {
    const nested = data.name;
    if (typeof nested === "string") return nested;
  }

  return null;
};

const normalizeValue = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.floor(value));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
};

const findGameNumber = (record: Record<string, unknown>, depth = 0): bigint | null => {
  if (depth > 3) return null;
  for (const key of ["game_number", "gameNumber"]) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = record[key as keyof typeof record];
      const parsed = normalizeValue(value);
      if (parsed !== null) return parsed;
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, "data")) {
    const nested = asRecord(record.data);
    if (nested) {
      const nestedValue = findGameNumber(nested, depth + 1);
      if (nestedValue !== null) return nestedValue;
    }
  }

  return null;
};

/**
 * Pull the highest game number from a factory row that exposes a `game_number`.
 */
export const extractGameNumberFromRow = (row: Record<string, unknown>): bigint | null => {
  return findGameNumber(row);
};

/**
 * Execute a Torii factory SQL query and return the raw rows.
 */
export const fetchFactoryRows = async (
  factorySqlBaseUrl: string,
  query: string,
): Promise<Record<string, unknown>[]> => {
  const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Factory query failed: ${res.status} ${res.statusText}`);
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) {
    throw new Error("Factory query returned unexpected payload");
  }
  return rows;
};
