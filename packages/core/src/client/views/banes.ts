import { StructureType, worldBanes } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactResult, NativeFactStore, ReadKeys } from "../native-fact-store";
import { dayOf } from "../../utils/days";

export const BANE_MODELS = [
  "BaneRules",
  "WorldBane",
  "FirstTeamBane",
  "HomeAspect",
  "TeamBane",
  "BaneProgress",
  "AspectActivity",
] as const;

type BaneIdentity = { type: "world"; kind: number; quest: number } | { type: "team"; source: number; quest: number };

export type BaneDay = BaneIdentity & {
  aspect: number;
  completed: number;
  required: number;
  endedAt: number;
};

/** The day's quest remains a bane quest after the Aspect ends its effect. */
export function readBaneDay(
  store: NativeFactStore,
  gameId: number,
  home: number | bigint,
  today: { index: number; start: number },
): NativeFactResult<{ bane: BaneDay | null }> {
  const day = today.index;
  const ruleReading = optionalBaneRow(store, "BaneRules", { game_id: gameId });
  if (!ruleReading.known) return ruleReading;
  const rules = ruleReading.known.row;
  if (!rules) return { known: { bane: null } };
  const membership = store.get("HomeAspect", { game_id: gameId, home });
  if (!membership) return { unknown: "MISSING_HOME_ASPECT" };
  const aspect = membership.aspect;
  const identity = readBaneIdentity(store, gameId, aspect, day);
  if (!identity.known) return identity;
  if (!identity.known.bane) return { known: { bane: null } };
  const active =
    day === 0
      ? { known: { active: 0 } }
      : store.requireOrAbsent("AspectActivity", { game_id: gameId, aspect, day: day - 1 });
  if (!active.known) return active;
  const progress = store.requireOrAbsent("BaneProgress", { game_id: gameId, aspect, day });
  if (!progress.known) return progress;
  const required = Math.ceil((active.known.active * rules.quorum_percent) / 100);
  return {
    known: {
      bane: {
        ...identity.known.bane,
        aspect,
        required,
        completed: progress.known.completed,
        endedAt: required === 0 ? today.start : Number(progress.known.ended_at),
      },
    },
  };
}

function readBaneIdentity(
  store: NativeFactStore,
  gameId: number,
  aspect: number,
  day: number,
): NativeFactResult<{ bane: BaneIdentity | null }> {
  const first = optionalBaneRow(store, "FirstTeamBane", { game_id: gameId });
  if (!first.known) return first;
  const team = optionalBaneRow(store, "TeamBane", { game_id: gameId, aspect, day });
  if (!team.known) return team;
  const stopped = first.known.row && day > Number(first.known.row.issued_day);
  const world = store.get("WorldBane", { game_id: gameId, day });
  if (!stopped && !world) return { unknown: "MISSING_WORLD_BANE_DAY" };
  const kind = stopped ? 0 : world!.kind;
  if (kind !== 0 && team.known.row) throw new Error("An Aspect cannot have world and team banes together");
  if (kind !== 0) return { known: { bane: { type: "world", kind, quest: worldQuest(kind) } } };
  if (team.known.row)
    return {
      known: {
        bane: {
          type: "team",
          source: team.known.row.source,
          quest: team.known.row.quest,
        },
      },
    };
  return { known: { bane: null } };
}

function worldQuest(kind: number): number {
  const bane = worldBanes.find((bane) => bane.id === kind);
  if (!bane) throw new Error(`Invalid world bane ${kind}`);
  return bane.quest;
}

function optionalBaneRow<M extends "BaneRules" | "FirstTeamBane" | "TeamBane">(
  store: NativeFactStore,
  model: M,
  keys: ReadKeys<M>,
): NativeFactResult<{ row: NativeRows[M] | undefined }> {
  const row = store.get(model, keys);
  if (row) return { known: { row } };
  const absence = store.absenceKnown(model, keys);
  return absence.known ? { known: { row: undefined } } : { unknown: absence.unknown };
}

function baneCalendar(store: NativeFactStore, gameId: number) {
  const game = store.require("GameRegistry", { game_id: gameId });
  const rules = store.require("SliceRules", { game_id: gameId });
  return {
    seed: game.seed,
    startMainAt: Number(game.start_main_at),
    endAt: Number(game.end_at),
    dayUnitSeconds: rules.day_unit_seconds,
  };
}

/** Historical windows use recorded rolls and exact quorum times, never today's rate applied to past output. */
export function readBaneEffects(
  store: NativeFactStore,
  gameId: number,
  home: number | bigint,
  from: number,
  until: number,
): NativeFactResult<{ windows: { kind: number; start: number; end: number }[]; productionPercent: number }> {
  const ruleReading = optionalBaneRow(store, "BaneRules", { game_id: gameId });
  if (!ruleReading.known) return ruleReading;
  const rules = ruleReading.known.row;
  const windows: { kind: number; start: number; end: number }[] = [];
  if (!rules) return { known: { windows, productionPercent: 100 } };
  const structure = store.get("Structure", { game_id: gameId, entity_id: home });
  if (!structure) return { unknown: "MISSING_PRODUCTION_STRUCTURE" };
  if (structure.base.category !== StructureType.Realm)
    return { known: { windows, productionPercent: rules.production_percent } };
  const calendar = baneCalendar(store, gameId);
  const end = Math.min(until, calendar.endAt);
  let cursor = Math.max(from, calendar.startMainAt);
  while (cursor < end) {
    const day = dayOf(calendar, cursor);
    if (!day) throw new Error("Bane interval is outside the season");
    const read = readBaneDay(store, gameId, home, day);
    if (!read.known) return read;
    const bane = read.known.bane;
    if (bane?.type === "world") {
      const stop = Math.min(end, day.end, bane.endedAt || day.end);
      if (cursor < stop) windows.push({ kind: bane.kind, start: cursor, end: stop });
    }
    cursor = day.end;
  }
  return { known: { windows, productionPercent: rules.production_percent } };
}
