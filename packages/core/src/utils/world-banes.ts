import { StructureType, worldBanes } from "@bibliothecadao/types";
import { hash, shortString } from "starknet";
import { nativeBaneConstants as bane } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactResult, NativeFactStore } from "../client/native-fact-store";
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

/** The bane quest a world bane brings (banes.cairo's quest_kind), from the catalog's world banes. */
export function baneQuest(kind: number): number {
  const world = worldBanes.find(({ id }) => id === kind);
  if (!world) throw new Error(`Unknown world bane ${kind}`);
  return world.quest;
}

/** A world bane on one day for one Aspect: which, and how far the Aspect is at ending it (banes.cairo's won). */
interface WorldBaneDay {
  kind: number;
  required: number;
  completed: number;
  endedAt: number;
  won: boolean;
}

/**
 * The world bane a home's Aspect has on a day, as banes.cairo rolls and ends it: known none, or its kind with the count
 * that ends it (25% of the Aspect's members active the day before, rounded up) and the members who finished. Unknown,
 * with the reason, while a row it rests on is neither present nor known absent. None in a game without banes.
 */
function readWorldBane(
  store: NativeFactStore,
  game_id: number,
  home: number | bigint,
  day: number,
): NativeFactResult<WorldBaneDay | null> | undefined {
  const rules = store.get("BaneRules", { game_id });
  if (!rules) return undefined;
  const game = store.require("GameRegistry", { game_id });
  const first = store.requireOrAbsent("FirstTeamBane", { game_id });
  if (!first.known) return { unknown: first.unknown };
  const kind = worldBane(game.seed, day, first.known.day === null ? null : Number(first.known.day), rules.chance_step);
  if (kind === null) return { known: null };
  const aspect = homeAspect(store, game_id, home);
  if (aspect.unknown !== undefined) return { unknown: aspect.unknown };
  const ending = readEnding(store, game_id, aspect.known, day, rules.quorum_percent);
  if (!ending.known) return ending;
  return { known: { kind, ...ending.known } };
}

/** A bane on one day for a home's Aspect: the mist's (world) or a rival's (team), its quest and how far it is ended. */
export interface DayBane {
  source: "world" | "team";
  /** The world bane's kind (Blood Moon, Mist Tide, Ash Fall); null for a team bane. */
  kind: number | null;
  /** The Aspect whose Altar sent a team bane; null for a world bane. */
  sender: number | null;
  /** The bane quest that replaces the daily quest: the Stand, the Lights or the Cull. */
  quest: number;
  required: number;
  completed: number;
  /** Ended by the Aspect: no one to wait for (nobody active the day before), or enough finished. */
  won: boolean;
}

/**
 * The bane a home's Aspect is under on a day, as banes.cairo's quest_kind picks it: a team bane first (TeamBane), else
 * the world bane, else none. Known none, the bane, or unknown with the reason. None in a game without banes.
 */
export function readDayBane(
  store: NativeFactStore,
  game_id: number,
  home: number | bigint,
  day: number,
): NativeFactResult<DayBane | null> | undefined {
  const rules = store.get("BaneRules", { game_id });
  if (!rules) return undefined;
  const aspect = homeAspect(store, game_id, home);
  if (aspect.unknown !== undefined) return { unknown: aspect.unknown };
  const team = store.get("TeamBane", { game_id, aspect: aspect.known, day });
  if (team) {
    const ending = readEnding(store, game_id, aspect.known, day, rules.quorum_percent);
    if (!ending.known) return ending;
    return { known: { source: "team", kind: null, sender: team.source, quest: team.quest, ...ending.known } };
  }
  const noTeam = store.absenceKnown("TeamBane", { game_id, aspect: aspect.known, day });
  if (!noTeam.known) return { unknown: noTeam.unknown };
  const world = readWorldBane(store, game_id, home, day)!;
  if (!world.known) return world.unknown === undefined ? { known: null } : { unknown: world.unknown };
  const { kind, required, completed, won } = world.known;
  return { known: { source: "world", kind, sender: null, quest: baneQuest(kind), required, completed, won } };
}

/** The home's Aspect; unknown while its row has not arrived (a bane game's Realm always joined one). */
function homeAspect(store: NativeFactStore, game_id: number, home: number | bigint): NativeFactResult<number> {
  const row = store.get("HomeAspect", { game_id, home });
  return row ? { known: row.aspect } : { unknown: `HomeAspect ${home} is not known` };
}

/** The count that ends the Aspect's bane on a day, the members who finished it, and when it ended, if it did. */
function readEnding(store: NativeFactStore, game_id: number, aspect: number, day: number, quorumPercent: number) {
  const activity =
    day === 0 ? { known: { active: 0 } } : store.requireOrAbsent("AspectActivity", { game_id, aspect, day: day - 1 });
  if (!activity.known) return { unknown: activity.unknown! };
  const progress = store.requireOrAbsent("BaneProgress", { game_id, aspect, day });
  if (!progress.known) return { unknown: progress.unknown };
  const required = Math.ceil((activity.known.active * quorumPercent) / 100);
  return {
    known: {
      required,
      completed: progress.known.completed,
      endedAt: Number(progress.known.ended_at),
      won: required === 0 || progress.known.ended_at !== 0n,
    },
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
      const read = readWorldBane(store, game_id, home, day.index)!;
      if (!read.known && read.unknown !== undefined) throw new Error(`World bane is unknown: ${read.unknown}`);
      const current = read.known;
      if (current?.kind === effect) {
        const end = current.required === 0 ? day.start : Math.min(current.endedAt || day.end, until);
        if (cursor < end) windows.push({ start: cursor, end, percent });
      }
      cursor = day.end;
    }
    return windows;
  };
}
