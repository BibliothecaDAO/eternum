import { CONFIG } from "./config";

// Determine how many realms each account should create
export function determineRealmCounts(accountCount: number): number[] {
  const realmCounts: number[] = [];

  for (let i = 0; i < accountCount; i++) {
    if (i === 0) {
      // First account
      realmCounts.push(CONFIG.realmDistribution.firstAccount);
    } else if (i === accountCount - 1) {
      // Last account
      realmCounts.push(CONFIG.realmDistribution.lastAccount);
    } else {
      // Middle accounts - random number between min and max
      const count = Math.floor(
        Math.random() * (CONFIG.realmDistribution.middleAccountsMax - CONFIG.realmDistribution.middleAccountsMin + 1) +
          CONFIG.realmDistribution.middleAccountsMin,
      );
      realmCounts.push(count);
    }
  }

  return realmCounts;
}
