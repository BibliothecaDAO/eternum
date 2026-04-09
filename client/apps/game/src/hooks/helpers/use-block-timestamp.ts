import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useShallow } from "zustand/react/shallow";

export const useCurrentBlockTimestamp = () => useBlockTimestampStore((state) => state.currentBlockTimestamp);

export const useCurrentDefaultTick = () => useBlockTimestampStore((state) => state.currentDefaultTick);

export const useCurrentArmiesTick = () => useBlockTimestampStore((state) => state.currentArmiesTick);

export const useBlockTimestamp = () =>
  useBlockTimestampStore(
    useShallow((state) => ({
      currentBlockTimestamp: state.currentBlockTimestamp,
      currentDefaultTick: state.currentDefaultTick,
      currentArmiesTick: state.currentArmiesTick,
      armiesTickTimeRemaining: state.armiesTickTimeRemaining,
    })),
  );
