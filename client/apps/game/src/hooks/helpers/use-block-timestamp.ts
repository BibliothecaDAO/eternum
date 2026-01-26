import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";

export const useBlockTimestamp = () => {
  const currentBlockTimestamp = useBlockTimestampStore((state) => state.currentBlockTimestamp);
  const currentDefaultTick = useBlockTimestampStore((state) => state.currentDefaultTick);
  const currentArmiesTick = useBlockTimestampStore((state) => state.currentArmiesTick);
  const armiesTickTimeRemaining = useBlockTimestampStore((state) => state.armiesTickTimeRemaining);

  return { currentBlockTimestamp, currentDefaultTick, currentArmiesTick, armiesTickTimeRemaining };
};
