const parseSeasonTimestamp = (value: unknown): number | null => {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        return Number(BigInt(trimmed));
      }

      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

export const resolveFiniteSeasonEndAt = (value: unknown): number | null => {
  const parsed = parseSeasonTimestamp(value);
  if (parsed == null || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const resolveSeasonStartTimestamp = (value: unknown): number | null => {
  const parsed = parseSeasonTimestamp(value);
  if (parsed == null || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const hasFiniteSeasonEnd = (seasonEndAt: number | null | undefined): seasonEndAt is number =>
  typeof seasonEndAt === "number" && Number.isFinite(seasonEndAt) && seasonEndAt > 0;
