import type { NativePreset } from "./native-preset";

/** The same effective day unit feeds world, ledger, calendar and operator tooling. */
export function seasonDayUnitSeconds(preset: Pick<NativePreset, "dayUnitSeconds" | "clockScale">): number {
  return clockScaled(preset.dayUnitSeconds, preset.clockScale?.days ?? 1, "day_unit_seconds");
}

/** Divide a season clock exactly, so world, ledger and launch boundaries use the same seconds. */
export function clockScaled(seconds: number, scale: number, name: string): number {
  if (!Number.isSafeInteger(scale) || scale <= 0) throw new Error("Season clock scale must be a positive integer");
  if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isSafeInteger(seconds / scale))
    throw new Error(`${name} ${seconds} does not divide by clock scale ${scale}`);
  return seconds / scale;
}
