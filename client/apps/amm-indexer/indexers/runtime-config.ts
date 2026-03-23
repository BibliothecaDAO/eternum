export interface IndexerRuntimeConfig {
  ammAddress: string;
  lordsAddress: string;
}

type RuntimeConfigKey = "AMM_ADDRESS" | "LORDS_ADDRESS";

export class InvalidIndexerRuntimeConfigError extends Error {
  readonly errorType = "invalid_runtime_config";

  constructor(
    readonly key: RuntimeConfigKey,
    readonly value: string,
  ) {
    super(`${key} must be a non-zero 0x-prefixed address`);
    this.name = "InvalidIndexerRuntimeConfigError";
  }
}

export function resolveIndexerRuntimeConfig(config: IndexerRuntimeConfig): IndexerRuntimeConfig {
  return {
    ammAddress: validateAddress("AMM_ADDRESS", config.ammAddress),
    lordsAddress: validateAddress("LORDS_ADDRESS", config.lordsAddress),
  };
}

function validateAddress(key: RuntimeConfigKey, value: string): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith("0x") || isZeroLikeAddress(trimmed)) {
    throw new InvalidIndexerRuntimeConfigError(key, value);
  }

  return trimmed;
}

function isZeroLikeAddress(value: string): boolean {
  const normalized = value.toLowerCase();

  if (normalized === "0x") {
    return true;
  }

  return normalized.slice(2).replace(/^0+/, "").length === 0;
}
