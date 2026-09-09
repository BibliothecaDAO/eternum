import { useEffect, useRef } from "react";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { useUISound } from "@/audio";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentArmiesTick, useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { resolveDayCycleProgress, resolveDebuggableCycleProgress } from "@/utils/cycle-progress";

/** Keep atmosphere and audio running independently of the header's presentation. */
export function GameCycleEffects() {
  const now = useCurrentBlockTimestamp();
  const tick = useCurrentArmiesTick();
  const override = useUIStore((state) => state.debugCycleProgressOverride);
  const setProgress = useUIStore((state) => state.setCycleProgress);
  const mode = useGameModeConfig();
  const playGong = useUISound(mode.audio.tickGongSound);
  const previousTick = useRef(tick);
  const duration = configManager.getTick(TickIds.Armies);
  useEffect(() => {
    setProgress(resolveDebuggableCycleProgress(resolveDayCycleProgress(now, duration), override));
  }, [now, duration, override, setProgress]);
  useEffect(() => {
    if (previousTick.current > 0 && tick > previousTick.current) playGong();
    previousTick.current = tick;
  }, [tick, playGong]);
  return null;
}
