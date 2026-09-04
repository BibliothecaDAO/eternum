import { shortString } from "starknet";

/**
 * Returns the SQL endpoint for the Torii that indexes the appchain factory.
 * Madara has one committed world and no factory discovery path.
 */
export function getFactorySqlBaseUrl(chain: string, _retiredApiBase?: string): string {
  if (chain !== "appchain") return "";

  const appchainToriiBaseUrl = resolveAppchainToriiBaseUrl();
  return appchainToriiBaseUrl ? `${appchainToriiBaseUrl}/sql` : "";
}

/** Shared torii for the appchain — env-driven so it follows the deployment. */
function resolveAppchainToriiBaseUrl(): string {
  const fromVite = typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_PUBLIC_TORII : undefined;
  const fromNode = typeof process !== "undefined" ? (process as any).env?.TORII_URL : undefined;
  return String(fromVite || fromNode || "").replace(/\/+$/, "");
}

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

export const decodePaddedFeltAscii = (hex: string): string => {
  if (!hex) return "";
  const normalizedHex = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (normalizedHex === "0") return "";

  try {
    const asDecimal = BigInt(`0x${normalizedHex}`).toString();
    const decoded = shortString.decodeShortString(asDecimal);
    if (decoded && decoded.trim().length > 0) return decoded;
  } catch {
    // Ignore decode failures and fall back to manual byte parsing.
  }

  let index = 0;
  while (index + 1 < normalizedHex.length && normalizedHex.slice(index, index + 2) === "00") index += 2;

  let output = "";
  for (; index + 1 < normalizedHex.length; index += 2) {
    const byte = parseInt(normalizedHex.slice(index, index + 2), 16);
    if (byte === 0) continue;
    output += String.fromCharCode(byte);
  }

  return output;
};

export const extractNameFelt = (row: Record<string, unknown>): string | null => {
  const direct = row.name ?? row["data.name"];
  if (typeof direct === "string") return direct;

  const data = asRecord(row.data);
  if (data && typeof data.name === "string") {
    return data.name;
  }

  return null;
};

export const fetchFactoryRows = async (
  factorySqlBaseUrl: string,
  query: string,
  opts?: { timeoutMs?: number },
): Promise<Record<string, unknown>[]> => {
  const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal: opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Factory query failed: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) {
    throw new Error("Factory query returned unexpected payload");
  }

  return rows;
};
