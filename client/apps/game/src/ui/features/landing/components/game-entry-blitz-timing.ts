export interface ResolveBlitzSettlementAvailabilityInput {
  startMainAt: number | null;
  nowSec: number;
}

export interface BlitzSettlementAvailability {
  unlockAtSec: number | null;
  isUnlocked: boolean;
  secondsUntilUnlock: number | null;
}

export const resolveBlitzSettlementAvailability = ({
  startMainAt,
  nowSec,
}: ResolveBlitzSettlementAvailabilityInput): BlitzSettlementAvailability => {
  if (startMainAt == null) {
    return {
      unlockAtSec: null,
      isUnlocked: false,
      secondsUntilUnlock: null,
    };
  }

  const secondsUntilUnlock = Math.max(0, startMainAt - nowSec);

  return {
    unlockAtSec: startMainAt,
    isUnlocked: secondsUntilUnlock === 0,
    secondsUntilUnlock,
  };
};
