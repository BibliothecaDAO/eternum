export const CHAIN_NAMES = Object.freeze({
  mainnet: "SN_MAIN",
  appchain: "WP_REALMS_DEV",
  madara: "WP_REALMS_MADARA_LAB",
});

export const GAME_CHAIN_NAMES = Object.freeze({
  appchain: CHAIN_NAMES.appchain,
  madara: CHAIN_NAMES.madara,
});

const CHAIN_LABELS = Object.freeze({
  mainnet: "Starknet mainnet",
  appchain: "appchain",
  madara: "madara",
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
  const chainName = CHAIN_NAMES[target];
  if (!chainName) throw new Error(`Unsupported chain target "${target}"`);
  return encodeChainName(chainName);
}

export function assertChainId(actualChainId, target, environmentName) {
  const expected = expectedChainId(target);
  if (BigInt(actualChainId) !== BigInt(expected)) {
    throw new Error(
      `${environmentName} is not ${CHAIN_LABELS[target]} (chain id ${actualChainId}, expected ${expected})`,
    );
  }
}

export async function assertProviderChain(provider, target, environmentName) {
  const chainId = await provider.getChainId();
  assertChainId(chainId, target, environmentName);
  return chainId;
}
