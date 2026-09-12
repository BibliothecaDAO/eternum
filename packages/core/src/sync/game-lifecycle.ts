/** A finite game clock closes gameplay even if no transaction updates the registry status. */
export function hasGameEnded(status: string, endAt: number, timestamp: number): boolean {
  if (status === "Ended" || status === "Settled") return true;
  if (!Number.isSafeInteger(endAt) || endAt < 0) throw new Error("GameRegistry.end_at must be a nonnegative integer");
  return endAt > 0 && timestamp >= endAt;
}
