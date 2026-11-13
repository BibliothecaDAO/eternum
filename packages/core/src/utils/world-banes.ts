import { StructureType } from "@bibliothecadao/types";
import { hash, shortString } from "starknet";
import {
  nativeBaneConstants as bane,
  nativeQuestConstants as quest,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../client/native-fact-store";
import { dayOf } from "./days";

export function worldBane(seed: bigint, day: number, firstTeamDay: number | null, chanceStep: number): number | null {
  if (!Number.isSafeInteger(day) || day < 0) throw new Error("Invalid bane day");
  if (!Number.isInteger(chanceStep) || chanceStep <= 0 || chanceStep > 100) throw new Error("Invalid bane chance");
  if (day === 0 || (firstTeamDay !== null && day > firstTeamDay)) return null;
  if (!calendarDraws || calendarDraws.seed !== seed || calendarDraws.step !== chanceStep)
    calendarDraws = { seed, step: chanceStep, chance: chanceStep, days: [null] };
  while (calendarDraws.days.length <= day) {
    const index = calendarDraws.days.length;
    const root = BigInt(hash.computePoseidonHashOnElements([seed, shortString.encodeShortString("world-bane"), index]));
    const low = root & ((1n << 128n) - 1n);
    const high = root >> 128n;
    const draw = (salt: number, upper: bigint) =>
      Number(BigInt(hash.computePoseidonHashOnElements([low, high, salt])) % upper);
    const kind = draw(0, 100n) < calendarDraws.chance ? draw(1, 3n) + 1 : null;
    calendarDraws.days.push(kind);
    calendarDraws.chance = kind === null ? Math.min(100, calendarDraws.chance + chanceStep) : 0;
  }
  return calendarDraws.days[day];
}

// One immutable draw sequence; switching games replaces it. Cutoffs and completions always come from the store.
let calendarDraws: { seed: bigint; step: number; chance: number; days: (number | null)[] } | undefined;

export function baneQuest(kind: number): number {
  switch (kind) {
    case bane.BLOOD_MOON:
      return quest.STAND;
    case bane.MIST_TIDE:
      return quest.LIGHTS;
    case bane.ASH_FALL:
      return quest.CULL;
    default:
      throw new Error(`Unknown world bane ${kind}`);
  }
}

export function readWorldBane(store: NativeFactStore, game_id: number, home: number | bigint, day: number) {
  const rules = store.get("BaneRules", { game_id });
  if (!rules) return undefined;
  const game = store.require("GameRegistry", { game_id });
  const first = store.requireOrAbsent("FirstTeamBane", { game_id });
  if (!first.known) throw new Error("World bane cutoff is unknown");
  const kind = worldBane(game.seed, day, first.known.day === null ? null : Number(first.known.day), rules.chance_step);
  if (kind === null) return undefined;
  const aspect = store.require("HomeAspect", { game_id, home }).aspect;
  const activity = store.requireOrAbsent("AspectActivity", { game_id, aspect, day: day - 1 });
  if (!activity.known) throw new Error("Aspect activity is unknown");
  const required = Math.ceil((activity.known.active * rules.quorum_percent) / 100);
  const progress = store.requireOrAbsent("BaneProgress", { game_id, aspect, day });
  if (!progress.known) throw new Error("Bane progress is unknown");
  return {
    kind,
    required,
    completed: progress.known.completed,
    endedAt: Number(progress.known.ended_at),
    won: required === 0 || progress.known.ended_at !== 0n,
  };
}

/** A transient calculation reads the current native facts each time it is evaluated. */
export function baneRateReader(store: NativeFactStore, game_id: number, home: number | bigint, effect: number) {
  const rules = store.get("BaneRules", { game_id });
  if (!rules) return undefined;
  const structure = store.require("Structure", { game_id, entity_id: home });
  const aspect = store.get("HomeAspect", { game_id, home });
  if (!aspect) {
    if (structure.base.category === StructureType.Realm) throw new Error("Realm Aspect is missing");
    return undefined;
  }
  const game = store.require("GameRegistry", { game_id });
  const calendar = {
    seed: game.seed,
    startMainAt: Number(game.start_main_at),
    endAt: Number(game.end_at),
    dayUnitSeconds: store.require("SliceRules", { game_id }).day_unit_seconds,
  };
  const percent = effect === bane.ASH_FALL ? rules.production_percent : rules.stamina_percent;
  return (from: number, until: number) => {
    const windows: { start: number; end: number; percent: number }[] = [];
    let cursor = Math.max(from, calendar.startMainAt);
    until = Math.min(until, calendar.endAt);
    while (cursor < until) {
      const day = dayOf(calendar, cursor)!;
      const current = readWorldBane(store, game_id, home, day.index);
      if (current?.kind === effect) {
        const end = current.required === 0 ? day.start : Math.min(current.endedAt || day.end, until);
        if (cursor < end) windows.push({ start: cursor, end, percent });
      }
      cursor = day.end;
    }
    return windows;
  };
}
