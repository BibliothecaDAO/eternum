const STARKNET_CHAIN_IDS: Partial<Record<string, string>> = {
  mainnet: "0x534e5f4d41494e",
  sepolia: "0x534e5f5345504f4c4941",
};

export function resolveEternumNetwork(chain: string): string {
  const parts = chain.split(".");
  if (parts.length !== 2 || parts[1] !== "eternum" || !parts[0]) {
    throw new Error(
      `Unsupported chain "${chain}". Expected a value like "slot.eternum" with the eternum suffix enforced.`,
    );
  }

  return parts[0];
}

export function resolveStarknetChainId(chain: string): string | undefined {
  return STARKNET_CHAIN_IDS[chain];
}
