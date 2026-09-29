export const shortAddress = (address: string): string =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

export const formatDate = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleDateString([], { month: "short", day: "numeric" });

export const ordinal = (rank: number): string => {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] ?? "th";
  return `${rank}${suffix}`;
};

/** Victory points are recorded with six decimals. */
export const formatPoints = (points: number): string => Math.round(points).toLocaleString();

export const sameAddress = (left: string, right: string): boolean => {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
};
