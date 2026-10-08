import { formatExact } from "@/ui/design-system/kit/amount";

export const ordinal = (rank: number): string => {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th";
  return `${rank}${suffix}`;
};

/** Victory points are recorded with six decimals. */
export const formatPoints = (points: number): string => formatExact(Math.round(points));

export const sameAddress = (left: string, right: string): boolean => {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
};
