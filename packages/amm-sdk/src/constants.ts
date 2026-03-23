/** Network configuration for the Eternum AMM. */
export interface NetworkConfig {
  ammAddress: string;
  lordsAddress: string;
}

/** Mainnet contract addresses (to be filled after deployment). */
export const MAINNET: NetworkConfig = {
  ammAddress: "",
  lordsAddress: "",
};

/** Sepolia testnet contract addresses (to be filled after deployment). */
export const SEPOLIA: NetworkConfig = {
  ammAddress: "",
  lordsAddress: "",
};

/** Default slippage tolerance in basis points (0.5%). */
export const DEFAULT_SLIPPAGE_BPS = 50n;

/** Default deadline offset in seconds (20 minutes). */
export const DEFAULT_DEADLINE_OFFSET = 1200;
