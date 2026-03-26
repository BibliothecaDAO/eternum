import { RpcProvider } from "starknet";

interface IndexerRuntimeConfig {
  factoryAddress: string;
  rpcUrl: string;
}

type RuntimeConfigKey = "FACTORY_ADDRESS" | "RPC_URL";

interface StartingBlockConfig {
  rpcUrl: string;
  startingBlock: string | undefined;
}

export class InvalidIndexerRuntimeConfigError extends Error {
  readonly errorType = "invalid_runtime_config";

  constructor(
    readonly key: RuntimeConfigKey,
    readonly value: string,
  ) {
    super(key === "RPC_URL" ? `${key} must be a valid URL` : `${key} must be a non-zero 0x-prefixed address`);
    this.name = "InvalidIndexerRuntimeConfigError";
  }
}

export class InvalidIndexerStartingBlockError extends Error {
  readonly errorType = "invalid_starting_block";

  constructor(readonly value: string) {
    super("STARTING_BLOCK must be a non-negative integer block number");
    this.name = "InvalidIndexerStartingBlockError";
  }
}

export function resolveIndexerRuntimeConfig(config: IndexerRuntimeConfig): IndexerRuntimeConfig {
  return {
    factoryAddress: validateAddress("FACTORY_ADDRESS", config.factoryAddress),
    rpcUrl: validateUrl("RPC_URL", config.rpcUrl),
  };
}

export async function resolveIndexerStartingBlock(
  config: StartingBlockConfig,
  loadHeadBlockNumber: (rpcUrl: string) => Promise<number> = fetchCurrentHeadBlockNumber,
): Promise<bigint> {
  const currentHeadBlock = BigInt(await loadHeadBlockNumber(config.rpcUrl));
  const configuredStartingBlock = parseConfiguredStartingBlock(config.startingBlock);

  if (configuredStartingBlock === null) {
    return currentHeadBlock;
  }

  return configuredStartingBlock;
}

function validateAddress(key: RuntimeConfigKey, value: string): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith("0x") || isZeroLikeAddress(trimmed)) {
    throw new InvalidIndexerRuntimeConfigError(key, value);
  }

  return normalizeAddress(trimmed);
}

function validateUrl(key: RuntimeConfigKey, value: string): string {
  const trimmed = value.trim();

  try {
    const parsed = new URL(trimmed);
    return parsed.toString();
  } catch {
    throw new InvalidIndexerRuntimeConfigError(key, value);
  }
}

function normalizeAddress(value: string): string {
  return `0x${value.slice(2).replace(/^0+/, "").toLowerCase() || "0"}`;
}

function isZeroLikeAddress(value: string): boolean {
  return normalizeAddress(value) === "0x0";
}

function parseConfiguredStartingBlock(value: string | undefined): bigint | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsedBlock = BigInt(trimmed);

    if (parsedBlock < 0n) {
      throw new InvalidIndexerStartingBlockError(trimmed);
    }

    return parsedBlock;
  } catch {
    throw new InvalidIndexerStartingBlockError(trimmed);
  }
}

async function fetchCurrentHeadBlockNumber(rpcUrl: string): Promise<number> {
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  return provider.getBlockNumber();
}
