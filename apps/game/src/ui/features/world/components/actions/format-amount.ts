export const formatAmount = (amount: number) => {
  return Intl.NumberFormat("en-US", {
    notation: amount < 0.01 ? "standard" : "compact",
    maximumFractionDigits: amount < 0.01 ? 6 : 2,
  }).format(amount);
};
