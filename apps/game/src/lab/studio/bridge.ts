import { TroopTier, TroopType } from "@bibliothecadao/types";

import type { LabClock, ProceduralTerrainDebugRendererHandle } from "@/three/debug/procedural-terrain-debug-renderer";
import { WeatherType } from "@/three/managers/weather-manager";
import { DAY_PHASE_PROGRESS } from "@/utils/cycle-progress";

import type { StudioPath, StudioPose } from "./camera-path";
import { STUDIO_TRIGGERS, type StudioStage, type StudioTrigger, type StudioTroop } from "./stage";
import { STUDIO_TAKES, isStudioTake } from "./takes";

/** Times of day by name, as the game's day names them. */
export const STUDIO_LIGHTS = {
  night: 0,
  dawn: DAY_PHASE_PROGRESS.dawn,
  morning: DAY_PHASE_PROGRESS.morning,
  noon: DAY_PHASE_PROGRESS.afternoon,
  dusk: DAY_PHASE_PROGRESS.dusk,
  evening: DAY_PHASE_PROGRESS.evening,
} as const;

export const STUDIO_TROOPS = {
  knight: TroopType.Knight,
  crossbowman: TroopType.Crossbowman,
  paladin: TroopType.Paladin,
} as const;

type TroopName = keyof typeof STUDIO_TROOPS;
type TroopChoice = { type?: TroopName; tier?: 1 | 2 | 3 };

/**
 * What a script films with, on `window.__studio`: the same calls the panel makes. Every call that plays something
 * returns a promise that settles when it has played, so a recorder can stop on it.
 */
export function createStudioBridge(
  stage: StudioStage,
  renderer: ProceduralTerrainDebugRendererHandle,
  view: { setClean(clean: boolean): void; setTake(take: string | null): void },
) {
  let clock: LabClock = { scale: 1, fixedStep: false };
  const trigger = (name: string, args: Record<string, unknown> = {}) => {
    if (!isStudioTrigger(name)) throw new Error(`Unknown studio trigger: ${name}`);
    if (name === "strike") renderer.strike();
    else stage.trigger(name, args);
  };
  const playTake = async (name: string) => {
    if (!isStudioTake(name)) throw new Error(`Unknown studio take: ${name}`);
    stage.reset();
    view.setTake(name);
    await stage.play(STUDIO_TAKES[name].path(stage.places()));
    view.setTake(null);
  };
  return {
    version: 1,
    trigger,
    take: playTake,
    takes: () => Object.keys(STUDIO_TAKES),
    triggers: () => [...STUDIO_TRIGGERS],
    /** Plays a camera path from where the camera is, its cues on time. */
    path: (path: StudioPath) => stage.play(path),
    stop: () => stage.stop(),
    reset: () => stage.reset(),
    /** Reads the camera, or moves it at once to the given pose (what it leaves out stays). */
    pose: (pose?: Partial<StudioPose>) => {
      if (pose) stage.setPose({ ...stage.pose(), ...pose });
      return stage.pose();
    },
    places: () => stage.places(),
    troops: (troops: { attacker?: TroopChoice; defender?: TroopChoice }) =>
      stage.setTroops({
        ...(troops.attacker && { attacker: resolveTroop(troops.attacker, stage.status().troops.attacker) }),
        ...(troops.defender && { defender: resolveTroop(troops.defender, stage.status().troops.defender) }),
      }),
    /** The world's speed: 0.25 to 2, and whether each frame advances it by exactly 1/60 s. */
    time: (next: Partial<LabClock>) => {
      clock = { ...clock, ...next, scale: Math.min(2, Math.max(0.05, next.scale ?? clock.scale)) };
      renderer.setClock(clock);
      return clock;
    },
    light: (time: keyof typeof STUDIO_LIGHTS | number) =>
      renderer.setCycleProgress(typeof time === "number" ? time : STUDIO_LIGHTS[time]),
    weather: (weather: `${WeatherType}`) => renderer.setWeather(weather as WeatherType),
    /** Hides the lab's header and the studio's panel, for a frame with nothing but the world. */
    clean: (clean = true) => view.setClean(clean),
    status: () => ({ ...stage.status(), clock, pose: stage.pose() }),
  };
}

export type StudioBridge = ReturnType<typeof createStudioBridge>;

const isStudioTrigger = (name: string): name is StudioTrigger => STUDIO_TRIGGERS.includes(name as StudioTrigger);

function resolveTroop(choice: TroopChoice, current: StudioTroop): StudioTroop {
  return {
    category: choice.type ? STUDIO_TROOPS[choice.type] : current.category,
    tier: choice.tier ? ([TroopTier.T1, TroopTier.T2, TroopTier.T3] as const)[choice.tier - 1] : current.tier,
  };
}
