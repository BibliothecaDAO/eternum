export const CHAIN_NAMES = Object.freeze({
  mainnet: "SN_MAIN",
  sepolia: "SN_SEPOLIA",
});

const CHAIN_LABELS = Object.freeze({
  mainnet: "Starknet mainnet",
  sepolia: "Starknet Sepolia",
});

export function encodeChainName(chainName) {
  if (!/^[\x00-\x7f]{1,31}$/.test(chainName)) {
    throw new Error(
      `Chain name must contain 1-31 ASCII characters, received "${chainName}"`,
    );
  }
  return `0x${Array.from(chainName, (character) => character.charCodeAt(0).toString(16).padStart(2, "0")).join("")}`;
}

export function expectedChainId(target) {
  if (typeof target === "object" && target !== null)
    return shardChainId(target);
  const chainName = CHAIN_NAMES[target];
  if (!chainName) throw new Error(`Unsupported chain target "${target}"`);
  return encodeChainName(chainName);
}

export function assertChainId(actualChainId, target, environmentName) {
  const expected = expectedChainId(target);
  assertExpectedChainId(
    actualChainId,
    expected,
    environmentName,
    typeof target === "object" ? "the manifest shard" : CHAIN_LABELS[target],
  );
}

export function assertExpectedChainId(
  actualChainId,
  expectedChainIdValue,
  environmentName,
  expectedLabel,
) {
  const expected = `0x${BigInt(expectedChainIdValue).toString(16)}`;
  if (BigInt(actualChainId) !== BigInt(expected)) {
    throw new Error(
      `${environmentName} is not ${expectedLabel} (chain id ${actualChainId}, expected ${expected})`,
    );
  }
}

export async function assertProviderChain(provider, target, environmentName) {
  const chainId = await provider.getChainId();
  assertChainId(chainId, target, environmentName);
  return chainId;
}

export function shardChainId(manifest) {
  const chainId = manifest?.shard?.chainId;
  if (
    typeof chainId !== "string" ||
    !/^0x[0-9a-f]+$/i.test(chainId) ||
    BigInt(chainId) <= 0n ||
    BigInt(chainId) >= (1n << 251n) + 17n * (1n << 192n) + 1n
  ) {
    throw new Error(
      "Shard manifest requires a nonzero felt shard.chainId in hexadecimal; initialize a fresh shard",
    );
  }
  return `0x${BigInt(chainId).toString(16)}`;
}
