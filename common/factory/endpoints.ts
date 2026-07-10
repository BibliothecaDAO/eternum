import {
  buildFactoryRuntimeAlias,
  parseRuntimeRegistry,
  resolveRuntimeEndpointAlias,
  type RuntimeRegistryV1,
} from "./runtime-registry";

type Chain = "slot" | "slottest" | "local" | "sepolia" | "mainnet" | string;

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }

  const value = (process as any).env?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

type RuntimeProvider = "aws" | "slot";

interface FactorySqlBaseUrlOptions {
  provider?: RuntimeProvider;
  registry?: RuntimeRegistryV1 | string;
  /** @deprecated Endpoint ownership now belongs to the runtime registry. */
  awsDomain?: string;
  /** @deprecated Endpoint ownership now belongs to the runtime registry. */
  cartridgeApiBase?: string;
}

/**
 * Returns the registered Factory Torii SQL alias for a chain.
 */
export function getFactorySqlBaseUrl(
  chain: Chain,
  optionsOrCartridgeApiBase?: FactorySqlBaseUrlOptions | string,
): string {
  const options =
    typeof optionsOrCartridgeApiBase === "string"
      ? { cartridgeApiBase: optionsOrCartridgeApiBase }
      : optionsOrCartridgeApiBase;

  if (!new Set(["mainnet", "sepolia", "slot", "slottest", "local"]).has(chain)) {
    return "";
  }

  const registry = resolveRegistry(options?.registry);
  return resolveRuntimeEndpointAlias(buildFactoryRuntimeAlias(chain), {
    provider: options?.provider,
    registry,
  });
}

function resolveRegistry(registry?: RuntimeRegistryV1 | string): RuntimeRegistryV1 | undefined {
  if (registry) {
    return parseRuntimeRegistry(registry);
  }

  const configuredRegistry = readEnv("RUNTIME_REGISTRY_JSON");
  return configuredRegistry ? parseRuntimeRegistry(configuredRegistry) : undefined;
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
