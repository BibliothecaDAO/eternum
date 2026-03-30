import { RpcProvider } from "starknet";

const parseAbiEntries = (abi: unknown): unknown[] => {
  if (Array.isArray(abi)) {
    return abi;
  }

  if (typeof abi !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(abi);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const extractContractAbiEntries = (contractClass: unknown): unknown[] => {
  if (!contractClass || typeof contractClass !== "object" || !("abi" in contractClass)) {
    return [];
  }

  return parseAbiEntries((contractClass as { abi?: unknown }).abi);
};

const abiEntryHasName = (entry: unknown, entrypoint: string): boolean => {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const namedEntry = entry as { name?: unknown; items?: unknown };
  if (typeof namedEntry.name === "string" && namedEntry.name === entrypoint) {
    return true;
  }

  if (!Array.isArray(namedEntry.items)) {
    return false;
  }

  return namedEntry.items.some((item) => abiEntryHasName(item, entrypoint));
};

const probeContractEntrypointSupport = async (
  provider: RpcProvider,
  contractAddress: string,
  entrypoint: string,
): Promise<boolean> => {
  try {
    const contractClass = await provider.getClassAt(contractAddress);
    const abiEntries = extractContractAbiEntries(contractClass);

    if (abiEntries.length === 0) {
      // If ABI introspection is unavailable, keep the old optimistic behavior.
      return true;
    }

    return abiEntries.some((entry) => abiEntryHasName(entry, entrypoint));
  } catch {
    return true;
  }
};

export const parseUint256CallResult = (result: string[] | undefined): bigint => {
  if (!result || result.length < 2) return 0n;
  const low = BigInt(result[0] ?? 0);
  const high = BigInt(result[1] ?? 0);
  return low + (high << 128n);
};

export const createContractEntrypointSupportResolver = (provider: RpcProvider) => {
  const supportByEntrypoint = new Map<string, boolean>();

  return async (contractAddress: string, entrypoint: string): Promise<boolean> => {
    const cacheKey = `${contractAddress.toLowerCase()}:${entrypoint}`;
    const cachedSupport = supportByEntrypoint.get(cacheKey);
    if (cachedSupport != null) {
      return cachedSupport;
    }

    const supported = await probeContractEntrypointSupport(provider, contractAddress, entrypoint);
    supportByEntrypoint.set(cacheKey, supported);
    return supported;
  };
};
