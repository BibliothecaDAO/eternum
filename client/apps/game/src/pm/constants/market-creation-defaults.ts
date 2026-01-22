/**
 * Shared constants for market creation and trading
 *
 * Fee values are in basis points (1 bp = 0.01%)
 * - 100 = 1%
 * - 1000 = 10%
 * - 10000 = 100%
 */

// Fixed fees (set on-chain, won't change)
export const PROTOCOL_FEE_BPS = 30n; // 0.3%
export const ORACLE_FEE_BPS = 50n; // 0.5%

// Creator fee charged on market creation (0 = no fee)
export const DEFAULT_CREATOR_FEE = "0";

// Trading fee curve - linearly interpolates from start to end over market duration
// Current: 0% at start → 10% at end
export const DEFAULT_FEE_CURVE_RANGE = {
  start: 0,
  end: 1000,
};

// Fee share curve - how much of trading fees go to creator vs vault
// Current: 100% to creator at start → 0% to creator at end
export const DEFAULT_FEE_SHARE_CURVE_RANGE = {
  start: 10000,
  end: 0,
};
