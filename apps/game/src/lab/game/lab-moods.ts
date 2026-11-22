import { useUIStore } from "@/hooks/store/use-ui-store";
import { WORLD_ATMOSPHERE_PRESETS, type TimeOfDayColors } from "@/three/effects/world-atmosphere-presets";
import { dayLightProgress } from "@/utils/cycle-progress";

const SURFACE_MOOD_CANDIDATES = {
  near: { sunColor: 0xffb878, skyColor: 0x8ca5cc, groundColor: 0x84705a, ambientColor: 0xa4b2c8 },
  medium: { sunColor: 0xffc590, skyColor: 0x90a8c6, groundColor: 0x7c6e5e, ambientColor: 0x9eafc0 },
  clean: { sunColor: 0xffd7ac, skyColor: 0x96aec2, groundColor: 0x767068, ambientColor: 0x9cadba },
} satisfies Record<string, Partial<TimeOfDayColors>>;

export function applyLabSurfaceMood(name: string | null): void {
  if (name === null) return;
  const candidate = SURFACE_MOOD_CANDIDATES[name as keyof typeof SURFACE_MOOD_CANDIDATES];
  if (!candidate) throw new Error(`No Surface mood named ${name}: ${Object.keys(SURFACE_MOOD_CANDIDATES).join(", ")}`);
  Object.assign(WORLD_ATMOSPHERE_PRESETS.afternoon, candidate);
}

export function applyLabDayLight(spent: string | null): void {
  if (spent === null) return;
  const share = Number(spent) / 100;
  if (!Number.isFinite(share)) throw new Error(`&day takes how much of the day is spent, 0 to 100, not ${spent}`);
  useUIStore.getState().setDebugCycleProgressOverride(dayLightProgress(share));
}
