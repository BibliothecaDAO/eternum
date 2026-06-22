import { shortString } from "starknet";

type Chain = "slot" | "slottest" | "local" | "sepolia" | "mainnet" | string;

const DEFAULT_CARTRIDGE_API_BASE = "https://api.cartridge.gg";
const DEFAULT_AWS_RUNTIME_DOMAIN = "runtime.realms.world";

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }

  const value = (process as any).env?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function shouldUseAwsFactoryRuntime(): boolean {
  return readEnv("FACTORY_RUNTIME_PROVIDER")?.toLowerCase() === "aws";
}

function resolveAwsRuntimeDomain(): string {
  return (readEnv("AWS_RUNTIME_DOMAIN") || DEFAULT_AWS_RUNTIME_DOMAIN).replace(/^https?:\/\//, "");
}

function resolveAwsFactoryRuntimeName(chain: Chain): string {
  switch (chain) {
    case "mainnet":
      return readEnv("AWS_FACTORY_TORII_MAINNET_RUNTIME_NAME") || "eternum-factory-mainnet";
    case "sepolia":
      return readEnv("AWS_FACTORY_TORII_SEPOLIA_RUNTIME_NAME") || "eternum-factory-sepolia";
    case "slot":
    case "slottest":
    case "local":
      return readEnv("AWS_FACTORY_TORII_SLOT_RUNTIME_NAME") || "eternum-factory-slot-d";
    default:
      return "";
  }
}

function buildAwsFactorySqlBaseUrl(chain: Chain): string {
  const runtimeName = resolveAwsFactoryRuntimeName(chain);
  return runtimeName ? `https://${resolveAwsRuntimeDomain()}/x/${runtimeName}/torii/sql` : "";
}

/**
 * Returns the Factory Torii SQL base URL for a given chain.
 * The Cartridge API base can be overridden; defaults to https://api.cartridge.gg.
 */
export function getFactorySqlBaseUrl(chain: Chain, cartridgeApiBase?: string): string {
  if (shouldUseAwsFactoryRuntime()) {
    return buildAwsFactorySqlBaseUrl(chain);
  }

  const base = cartridgeApiBase || readEnv("CARTRIDGE_API_BASE") || DEFAULT_CARTRIDGE_API_BASE;
  switch (chain) {
    case "mainnet":
      return `${base}/x/eternum-factory-mainnet/torii/sql`;
    case "sepolia":
      return `${base}/x/eternum-factory-sepolia/torii/sql`;
    case "slot":
    case "slottest":
    case "local":
      return `${base}/x/eternum-factory-slot-d/torii/sql`;
    default:
      return "";
  }
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
