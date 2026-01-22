import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";

export const useBlockTimestamp = () => {
  return useBlockTimestampStore((state) => ({
    currentBlockTimestamp: state.currentBlockTimestamp,
    currentDefaultTick: state.currentDefaultTick,
    currentArmiesTick: state.currentArmiesTick,
    armiesTickTimeRemaining: state.armiesTickTimeRemaining,
  }));
};
