export type ResolvedGameMode = "blitz" | "eternum" | "unknown";

export const parseMaybeBooleanFlag = (value: unknown): boolean | null => {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "bigint") return value !== 0n;

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "1") return true;
    if (trimmed === "0") return false;

    try {
      if (trimmed.startsWith("0x")) {
        return BigInt(trimmed) !== 0n;
      }

      const numericValue = Number(trimmed);
      if (Number.isFinite(numericValue)) {
        return numericValue !== 0;
      }
    } catch {
      return null;
    }
  }

  return null;
};

export const resolveGameModeFromBlitzFlag = (blitzModeOn: unknown): ResolvedGameMode => {
  const isBlitzMode = parseMaybeBooleanFlag(blitzModeOn);
  if (isBlitzMode === true) return "blitz";
  if (isBlitzMode === false) return "eternum";
  return "unknown";
};
