/**
 * PM Configuration
 * Re-exports the PREDICTION_MARKET_CONFIG from the landing section
 * to provide a clean accessor for SQL queries and other PM-specific code.
 */
export { PREDICTION_MARKET_CONFIG } from "@/ui/features/landing/sections/markets";

// Helper to get the SQL endpoint URL for the PM Torii instance
export const getPmToriiSqlUrl = () => {
  // Import dynamically to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PREDICTION_MARKET_CONFIG } = require("@/ui/features/landing/sections/markets");
  return `${PREDICTION_MARKET_CONFIG.toriiUrl}/sql`;
};
