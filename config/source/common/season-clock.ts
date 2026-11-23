import type { NativePreset } from "./native-preset";

/** The same effective day unit feeds world, ledger, calendar and operator tooling. */
export function seasonDayUnitSeconds(preset: Pick<NativePreset, "id" | "dayUnitSeconds" | "clockScale">): number {
  return clockScaled(preset.dayUnitSeconds, gameClockScale(preset), "day_unit_seconds");
}

/** Divide a season clock exactly, so world, ledger and launch boundaries use the same seconds. */
export function clockScaled(seconds: number, scale: number, name: string): number {
  if (!Number.isSafeInteger(scale) || scale <= 0) throw new Error("Season clock scale must be a positive integer");
  if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isSafeInteger(seconds / scale))
    throw new Error(`${name} ${seconds} does not divide by clock scale ${scale}`);
  return seconds / scale;
}

export const RELIC_SECONDS_PER_RANK = 1800;

export function gameClockScale(preset: Pick<NativePreset, "id" | "clockScale">): number {
  const scale = preset.clockScale ?? 1;
  if (!Number.isSafeInteger(scale) || scale < 1) throw new Error("Season clock scale must be a positive integer");
  return scale;
}

type ClockValue = number | bigint | string;
type ClockedDefinition = {
  rules: {
    tick_config: { armies_tick_in_seconds: ClockValue };
    day_unit_seconds: ClockValue;
    relic_seconds_per_rank: ClockValue;
  };
  resources: {
    resources: { realm_rate: ClockValue; village_rate: ClockValue }[];
    mine_kinds: { config: { production_rate: ClockValue } }[];
  };
  structures: { camps: { labor_rate: ClockValue }; board: { unwrap(): unknown } };
};

function scaleActivityClocks(definition: ClockedDefinition, scale: number): void {
  const tick = definition.rules.tick_config;
  tick.armies_tick_in_seconds = shortened(tick.armies_tick_in_seconds, scale, "armies_tick_in_seconds");
  for (const resource of definition.resources.resources) {
    resource.realm_rate = quickened(resource.realm_rate, scale);
    resource.village_rate = quickened(resource.village_rate, scale);
  }
  definition.structures.camps.labor_rate = quickened(definition.structures.camps.labor_rate, scale);
  const board = definition.structures.board.unwrap() as { workshop_rate?: ClockValue } | undefined;
  if (board?.workshop_rate === undefined) throw new Error("A scaled season requires a workshop rate");
  board.workshop_rate = quickened(board.workshop_rate, scale);
  for (const mine of definition.resources.mine_kinds)
    mine.config.production_rate = quickened(mine.config.production_rate, scale);
}

export function scaleGameClocks<Definition extends ClockedDefinition>(
  definition: Definition,
  scale: number,
): Definition {
  if (scale === 1) return definition;
  const scaled = copied(definition);
  scaleActivityClocks(scaled, scale);
  scaled.rules.day_unit_seconds = shortened(scaled.rules.day_unit_seconds, scale, "day_unit_seconds");
  scaled.rules.relic_seconds_per_rank = shortened(scaled.rules.relic_seconds_per_rank, scale, "relic_seconds_per_rank");
  return scaled;
}

function copied<Value>(value: Value): Value {
  if (Array.isArray(value)) return value.map(copied) as Value;
  if (value === null || typeof value !== "object") return value;
  const copy = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
  for (const [key, member] of Object.entries(value)) copy[key] = copied(member);
  return copy as Value;
}

function shortened<Value extends ClockValue>(value: Value, scale: number, name: string): Value {
  return asClock(value, clockScaled(Number(value), scale, name));
}

function quickened<Value extends ClockValue>(value: Value, scale: number): Value {
  return asClock(value, BigInt(value) * BigInt(scale));
}

function asClock<Value extends ClockValue>(like: Value, value: number | bigint): Value {
  if (typeof like === "bigint") return BigInt(value) as Value;
  if (typeof like === "string") return String(value) as Value;
  return Number(value) as Value;
}
