export const extractTransactionHash = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null;

  const maybeHash = (value as { transaction_hash?: unknown }).transaction_hash;
  return typeof maybeHash === "string" && maybeHash.length > 0 ? maybeHash : null;
};
