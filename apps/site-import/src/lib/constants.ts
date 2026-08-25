// Contract addresses for veLORDS ecosystem
export const CONTRACTS = {
  // StarkNet mainnet addresses
  STARKNET: {
    VELORDS:
      "0x047230028629128ac5bfbb384d32f925e70e329b624fc5d82e9c60f5746795cd" as `0x${string}`, // Replace with actual veLORDS contract address
    REWARD_POOL:
      "0x0091b13b83e5c34112aa066a844d4cbe6af99b3d134293829ca1730ea4869a71" as `0x${string}`, // Replace with actual RewardPool contract address
    LORDS_TOKEN:
      "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49" as `0x${string}`,
    DLORDS: "0x0" as `0x${string}`, // Replace with actual dLORDS contract address
  },
  // Ethereum mainnet addresses (if needed)
  ETHEREUM: {
    LORDS_TOKEN: "0x686f2404e77ab0d9070a46cdfb0b7fecdd2318b0",
  },
};

// Time constants matching the Cairo contract
export const TIME_CONSTANTS = {
  DAY: 86400, // 3600 * 24
  WEEK: 604800, // DAY * 7
  TOKEN_CHECKPOINT_DEADLINE: 86400, // DAY
  ITERATION_LIMIT: 500,
  PROTOCOL_START_TIME: 1725494400, // September 5, 2024 - veLORDS protocol launch
};

// APY calculation constants
export const APY_CONSTANTS = {
  BLOCKS_PER_YEAR: 52, // 52 weeks per year
  BASIS_POINTS: 10000,
  DECIMALS: 18,
};

/** Total $LORDS token supply */
export const LORDS_TOTAL_SUPPLY = 300_000_000;

/** Minimum votes required for a governance proposal to pass quorum */
export const PROPOSAL_QUORUM = 1500;

/** Fixed header height offset for scroll-to-section calculations (px) */
export const HEADER_SCROLL_OFFSET = 108;
