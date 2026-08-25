import { TIME_CONSTANTS } from "./constants";

/**
 * Calculate the amortized APY over different time periods
 * @param weeklyYield - The weekly yield as a decimal (e.g., 0.01 for 1%)
 * @param periods - Number of periods to compound
 * @returns The amortized yield
 */
export function amortizeYield(weeklyYield: number, periods: number): number {
  // Compound interest formula: (1 + r)^n - 1
  return Math.pow(1 + weeklyYield, periods) - 1;
}

/**
 * Calculate APY from weekly yield
 * @param weeklyYield - The weekly yield as a decimal
 * @returns The annual percentage yield
 */
export function calculateAPY(weeklyYield: number): number {
  return amortizeYield(weeklyYield, 52) * 100;
}

/**
 * Calculate the veLORDS amount based on lock duration
 * Uses linear decay: longer lock = more veLORDS
 * @param lordsAmount - Amount of LORDS to lock
 * @param lockWeeks - Number of weeks to lock (1-208)
 * @returns The veLORDS balance
 */
export function calculateVeLordsAmount(
  lordsAmount: number,
  lockWeeks: number
): number {
  const MAX_LOCK_WEEKS = 208; // 4 years
  return lordsAmount * (lockWeeks / MAX_LOCK_WEEKS);
}

/**
 * Calculate expected rewards for a given veLORDS position
 * @param veLordsBalance - User's veLORDS balance
 * @param totalVeSupply - Total veLORDS supply
 * @param weeklyRewards - Total weekly rewards distributed
 * @returns Expected weekly rewards for the user
 */
export function calculateUserRewards(
  veLordsBalance: number,
  totalVeSupply: number,
  weeklyRewards: number
): number {
  if (totalVeSupply === 0) return 0;
  return (veLordsBalance / totalVeSupply) * weeklyRewards;
}

/**
 * Format a timestamp to a readable date
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatUnlockDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Calculate time until unlock
 * @param unlockTimestamp - Unix timestamp in seconds
 * @returns Object with days, hours, minutes until unlock
 */
export function getTimeUntilUnlock(unlockTimestamp: number): {
  days: number;
  hours: number;
  minutes: number;
  isUnlocked: boolean;
} {
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = unlockTimestamp - now;

  if (timeLeft <= 0) {
    return { days: 0, hours: 0, minutes: 0, isUnlocked: true };
  }

  const days = Math.floor(timeLeft / TIME_CONSTANTS.DAY);
  const hours = Math.floor((timeLeft % TIME_CONSTANTS.DAY) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);

  return { days, hours, minutes, isUnlocked: false };
}

/**
 * Get the boost multiplier based on lock duration
 * @param lockWeeks - Number of weeks locked
 * @returns Boost multiplier (1x to 4x)
 */
export function getBoostMultiplier(lockWeeks: number): number {
  const MAX_LOCK_WEEKS = 208;
  const MIN_MULTIPLIER = 1;
  const MAX_MULTIPLIER = 4;

  return (
    MIN_MULTIPLIER +
    (MAX_MULTIPLIER - MIN_MULTIPLIER) * (lockWeeks / MAX_LOCK_WEEKS)
  );
}

/**
 * Calculate the decay rate for veLORDS
 * veLORDS balance decreases linearly over time
 * @param initialAmount - Initial veLORDS amount
 * @param weeksElapsed - Weeks since lock creation
 * @param totalLockWeeks - Total lock duration in weeks
 * @returns Current veLORDS balance after decay
 */
export function calculateDecayedBalance(
  initialAmount: number,
  weeksElapsed: number,
  totalLockWeeks: number
): number {
  if (weeksElapsed >= totalLockWeeks) return 0;

  const remainingWeeks = totalLockWeeks - weeksElapsed;
  return initialAmount * (remainingWeeks / totalLockWeeks);
}
