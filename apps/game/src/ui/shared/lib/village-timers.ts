const MILITIA_UNLOCK_DELAY_SECONDS = 24 * 60 * 60;

type NumericLike = number | bigint | string | null | undefined;

interface VillageTimerSummary {
  militiaUnlockRemainingSeconds: number;
}

interface BuildVillageTimerSummaryParams {
  createdAtTimestamp: NumericLike;
  currentBlockTimestamp: NumericLike;
}

const toFiniteNumber = (value: NumericLike): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const buildVillageTimerSummary = ({
  createdAtTimestamp,
  currentBlockTimestamp,
}: BuildVillageTimerSummaryParams): VillageTimerSummary | null => {
  const createdAt = toFiniteNumber(createdAtTimestamp);
  const currentTimestamp = toFiniteNumber(currentBlockTimestamp);

  if (createdAt === null || currentTimestamp === null || createdAt <= 0) {
    return null;
  }

  return {
    militiaUnlockRemainingSeconds: Math.max(0, createdAt + MILITIA_UNLOCK_DELAY_SECONDS - currentTimestamp),
  };
};
