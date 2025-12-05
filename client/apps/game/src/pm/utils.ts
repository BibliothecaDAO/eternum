export const deepEqual = (a: unknown, b: unknown) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export const formatUnits = (value: string | number | bigint, decimals: number, precision = 2) => {
  const big = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(big)) return "0";
  const scaled = big / 10 ** decimals;
  return scaled.toFixed(precision);
};

export const formatCurrency = (value: string, _decimals: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};
