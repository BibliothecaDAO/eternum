export const parseLordsToBaseUnits = (value: string, decimals = 18): bigint | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d*(\.\d*)?$/.test(trimmed)) return null;

  const [wholeRaw, fractionRaw = ""] = trimmed.split(".");
  const whole = wholeRaw ? BigInt(wholeRaw) : 0n;
  const paddedFraction = (fractionRaw + "0".repeat(decimals)).slice(0, decimals);
  const fraction = paddedFraction ? BigInt(paddedFraction) : 0n;

  return whole * 10n ** BigInt(decimals) + fraction;
};

export const formatTimestamp = (value: number | null): string => {
  if (!value) return "Not available";
  return new Date(value * 1000).toLocaleString();
};
