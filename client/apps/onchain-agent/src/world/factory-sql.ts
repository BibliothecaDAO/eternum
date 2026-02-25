import { shortString } from "starknet";

export const decodePaddedFeltAscii = (hex: string): string => {
  if (!hex) return "";
  const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (h === "0") return "";

  try {
    const asDec = BigInt(`0x${h}`).toString();
    const decoded = shortString.decodeShortString(asDec);
    if (decoded && decoded.trim().length > 0) return decoded;
  } catch {
    // fallback to manual decode
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

export const fetchFactoryRows = async (
  factorySqlBaseUrl: string,
  query: string,
): Promise<Record<string, unknown>[]> => {
  const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`Factory query failed: ${res.status} ${res.statusText}`);
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) {
    throw new Error("Factory query returned unexpected payload");
  }
  return rows;
};
