import { useEffect, useRef } from "react";
import { configManager, isEtherealTile, type ExpeditionRules } from "@bibliothecadao/eternum";
import { TickIds, type HexPosition } from "@bibliothecadao/types";
import { useUISound } from "@/audio";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import {
  useCoarseNowSeconds,
  useCurrentArmiesTick,
  useCurrentBlockTimestamp,
} from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { dayLightProgress, resolveDayCycleProgress, SURFACE_MOOD_PROGRESS } from "@/utils/cycle-progress";
import { useExpeditionRules } from "@/ui/features/frontier/frontier-home";
import { dayClock } from "@/ui/features/frontier/hud/day-clock";
import { isWorldInteractive } from "@/game-entry/world-interactive";

const DAY_LIGHT_STEP_SECONDS = 5;

const isSurfaceInView = (rules: ExpeditionRules | null, camera: HexPosition | null, alt: boolean): boolean =>
  camera === null ? !alt : !isEtherealTile(rules, { row: camera.row, alt });

export function GameCycleEffects() {
  const blockNow = useCurrentBlockTimestamp();
  const tick = useCurrentArmiesTick();
  const setProgress = useUIStore((state) => state.setCycleProgress);
  const mode = useGameModeConfig();
  const playGong = useUISound(mode.audio.tickGongSound);
  const previousTick = useRef(tick);
  const duration = configManager.getTick(TickIds.Armies);
  const rules = useExpeditionRules();
  const now = useCoarseNowSeconds(DAY_LIGHT_STEP_SECONDS, rules !== null);
  const onSurface = useUIStore((state) => isSurfaceInView(rules, state.cameraTargetHex, state.mapLayer));
  const shareLeft = rules && onSurface ? dayClock(rules, now).shareLeft : undefined;
  useEffect(() => {
    if (rules) {
      setProgress(shareLeft === undefined ? SURFACE_MOOD_PROGRESS : dayLightProgress(1 - shareLeft));
      return;
    }
    setProgress(resolveDayCycleProgress(blockNow, duration));
  }, [rules, shareLeft, blockNow, duration, setProgress]);
  useEffect(() => {
    // The tick jumps once as the game's data first arrives: no gong, and no gong file, before the first view is up.
    if (previousTick.current > 0 && tick > previousTick.current && isWorldInteractive()) playGong();
    previousTick.current = tick;
  }, [tick, playGong]);
  return null;
}
