import { resources } from "./resources";

export const findResourceById = (value: number) => {
  return resources.find((e) => e.id === value);
};

export const RESOURCE_PRECISION = 1_000_000_000;

/** Victory points carry six decimals on chain: every points fact and points config is in these units. */
const POINTS_PRECISION = 1_000_000;

/** Whole victory points from an on-chain amount. */
export const wholePoints = (amount: bigint | number): number => Number(amount) / POINTS_PRECISION;

/** Whether two whole-points values are the same on-chain amount, however each was summed from six-decimal parts. */
export const samePoints = (left: number, right: number): boolean =>
  Math.round(left * POINTS_PRECISION) === Math.round(right * POINTS_PRECISION);
