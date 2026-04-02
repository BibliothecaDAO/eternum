const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

type FactoryRow = Record<string, unknown>;

export function getFactorySqlBaseUrl(chain: string): string {
  switch (chain) {
    case "mainnet":
      return `${CARTRIDGE_API_BASE}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${CARTRIDGE_API_BASE}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${CARTRIDGE_API_BASE}/x/eternum-factory-slot-d/torii/sql`;
    default:
      return "";
  }
}

export async function fetchFactoryRows(
  factorySqlBaseUrl: string,
  query: string,
  timeoutMs: number,
): Promise<FactoryRow[]> {
  const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Factory query failed: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as FactoryRow[];
  if (!Array.isArray(rows)) {
    throw new Error("Factory query returned unexpected payload");
  }

  return rows;
}

export function extractNameFelt(row: FactoryRow): string | null {
  const directName = row.name ?? row["data.name"];
  if (typeof directName === "string") {
    return directName;
  }

  const nestedData = asRecord(row.data);
  if (nestedData && typeof nestedData.name === "string") {
    return nestedData.name;
  }

  return null;
}

export function decodePaddedFeltAscii(hex: string): string {
  if (!hex) return "";

  const normalizedHex = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (!normalizedHex || normalizedHex === "0") return "";

  let byteIndex = 0;
  while (byteIndex + 1 < normalizedHex.length && normalizedHex.slice(byteIndex, byteIndex + 2) === "00") {
    byteIndex += 2;
  }

  let output = "";
  for (; byteIndex + 1 < normalizedHex.length; byteIndex += 2) {
    const byteValue = Number.parseInt(normalizedHex.slice(byteIndex, byteIndex + 2), 16);
    if (Number.isNaN(byteValue) || byteValue === 0) continue;
    output += String.fromCharCode(byteValue);
  }

  return output;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsedValue = JSON.parse(value);
      if (parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)) {
        return parsedValue as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}
