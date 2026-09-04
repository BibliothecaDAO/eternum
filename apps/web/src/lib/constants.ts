// Contract addresses for veLORDS ecosystem

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
