interface ResolveBlitzSettlementAvailabilityInput {
  registrationStartAt: number | null;
  registrationEndAt: number | null;
  devModeOn?: boolean;
  nowSec: number;
}

interface BlitzSettlementAvailability {
  unlockAtSec: number | null;
  isUnlocked: boolean;
  secondsUntilUnlock: number | null;
}

export const resolveBlitzSettlementAvailability = ({
  registrationStartAt,
  registrationEndAt,
  devModeOn = false,
  nowSec,
}: ResolveBlitzSettlementAvailabilityInput): BlitzSettlementAvailability => {
  if (devModeOn) {
    return {
      unlockAtSec: registrationStartAt,
      isUnlocked: true,
      secondsUntilUnlock: 0,
    };
  }

  if (registrationStartAt == null) {
    return {
      unlockAtSec: null,
      isUnlocked: false,
      secondsUntilUnlock: null,
    };
  }

  if (registrationEndAt != null && registrationEndAt > registrationStartAt && nowSec >= registrationEndAt) {
    return {
      unlockAtSec: registrationStartAt,
      isUnlocked: false,
      secondsUntilUnlock: 0,
    };
  }

  const secondsUntilUnlock = Math.max(0, registrationStartAt - nowSec);

  return {
    unlockAtSec: registrationStartAt,
    isUnlocked: secondsUntilUnlock === 0,
    secondsUntilUnlock,
  };
};
