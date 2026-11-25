import { aspects, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRaceConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";

export const RACE_MODELS = [
  "RaceRules",
  "RaceMember",
  "AspectHyperstructure",
  "TriumphDay",
  "RaceResult",
  "HomeAspect",
  "AspectMembers",
  "Structure",
  "EntityName",
  "GameRegistry",
  "AltarBar",
  "DeepRules",
] as const;

export interface RaceMemberRow {
  home: bigint;
  glory: bigint;
  contribution: bigint;
  mine: boolean;
}

export interface RaceBoard {
  rules: NativeRows["RaceRules"];
  result: NativeRows["RaceResult"] | null;
  standings: (NativeRows["AspectHyperstructure"] & { rank: number; stage: number; finished: boolean })[];
  aspects: { aspect: number; members: RaceMemberRow[] }[];
  own: {
    aspect: number;
    triumphs: { stage: number; day: bigint | null }[];
    bar: { charge: number; threshold: number };
    members: RaceMemberRow[];
  } | null;
}

/** Null means the preset has no race; incomplete native facts never become zero Glory or an empty leaderboard. */
export function readRaceBoard(
  store: NativeFactStore,
  gameId: number,
  home: bigint | null,
): NativeFactResult<{ race: RaceBoard | null }> {
  const complete = store.absenceKnown("RaceRules", { game_id: gameId });
  if (!complete.known) return complete;
  const rules = store.get("RaceRules", { game_id: gameId });
  if (!rules) return { known: { race: null } };
  const rows: NativeRows["AspectHyperstructure"][] = [];
  for (const aspect of aspects) {
    const row = store.get("AspectHyperstructure", { game_id: gameId, aspect: aspect.id });
    if (!row) return { unknown: "MISSING_ASPECT_HYPERSTRUCTURE" };
    rows.push(row);
  }
  const standings = rankRaceStandings(rows, rules.stage_height);
  const rosters: RaceBoard["aspects"] = [];
  for (const { id } of aspects) {
    const members = readAspectMembers(store, gameId, id, home);
    if (!members.known) return members;
    rosters.push({ aspect: id, members: members.known.members });
  }
  const own = readOwnAspect(store, gameId, home, rosters);
  if (!own.known) return own;
  return {
    known: {
      race: {
        rules,
        standings,
        result: store.get("RaceResult", { game_id: gameId }) ?? null,
        aspects: rosters,
        own: own.known.own,
      },
    },
  };
}

function readAspectMembers(
  store: NativeFactStore,
  gameId: number,
  aspect: number,
  home: bigint | null,
): NativeFactResult<{ members: RaceMemberRow[] }> {
  const count = store.get("AspectMembers", { game_id: gameId, aspect });
  if (!count) {
    const absent = store.absenceKnown("AspectMembers", { game_id: gameId, aspect });
    if (!absent.known) return absent;
  }
  const memberships = [...store.inGame("HomeAspect", gameId)].filter((row) => row.aspect === aspect);
  if (memberships.length !== (count?.members ?? 0)) return { unknown: "INCOMPLETE_ASPECT_MEMBERS" };
  const members: RaceMemberRow[] = [];
  for (const row of memberships) {
    const member = store.requireOrAbsent("RaceMember", { game_id: gameId, entity_id: row.home });
    if (!member.known) return member;
    members.push({
      home: row.home,
      glory: member.known.glory,
      contribution: member.known.contribution,
      mine: row.home === home,
    });
  }
  members.sort(compareAspectMembers);
  return { known: { members } };
}

function readOwnAspect(
  store: NativeFactStore,
  gameId: number,
  home: bigint | null,
  rosters: RaceBoard["aspects"],
): NativeFactResult<{ own: RaceBoard["own"] }> {
  if (home === null) return { known: { own: null } };
  const membership = store.get("HomeAspect", { game_id: gameId, home });
  if (!membership) return { unknown: "MISSING_HOME_ASPECT" };
  const { aspect } = membership;
  if (!store.get("AspectMembers", { game_id: gameId, aspect })) return { unknown: "INCOMPLETE_ASPECT_MEMBERS" };
  const members = rosters.find((roster) => roster.aspect === aspect)?.members ?? [];
  const triumphs = Array.from({ length: nativeRaceConstants.STAGE_COUNT - 1 }, (_, index) => {
    const stage = index + 1;
    return { stage, day: store.get("TriumphDay", { game_id: gameId, aspect, stage })?.day ?? null };
  });
  const bar = store.requireOrAbsent("AltarBar", { game_id: gameId, aspect });
  if (!bar.known) return bar;
  const deep = store.get("DeepRules", { game_id: gameId });
  if (!deep) return { unknown: "MISSING_DEEP_RULES" };
  return {
    known: { own: { aspect, members, triumphs, bar: { charge: bar.known.charge, threshold: deep.altar_threshold } } },
  };
}

export const gloryAmount = (raw: bigint | string): number => Number(BigInt(raw)) / RESOURCE_PRECISION;

export const compareAspectMembers = (a: { glory: bigint; home: bigint }, b: { glory: bigint; home: bigint }): number =>
  a.glory === b.glory ? (a.home < b.home ? -1 : 1) : a.glory > b.glory ? -1 : 1;

export const raceStage = (height: number, stageHeight: number): number =>
  stageHeight <= 0 ? 1 : Math.min(nativeRaceConstants.STAGE_COUNT, Math.floor(Math.max(0, height) / stageHeight) + 1);

export const raceFinishHeight = (stageHeight: number): number => stageHeight * nativeRaceConstants.STAGE_COUNT;

export const raceStageHeight = (finishHeight: number): number =>
  Math.round(finishHeight / nativeRaceConstants.STAGE_COUNT);

export function rankRaceStandings<Row extends { aspect: number; height: number }>(
  rows: readonly Row[],
  stageHeight: number,
): (Row & { rank: number; stage: number; finished: boolean })[] {
  const finish = raceFinishHeight(stageHeight);
  const ranked = rows.map((row) => {
    if (row.height > finish) throw new Error("Race height exceeds its finish");
    return {
      ...row,
      rank: 0,
      stage: raceStage(row.height, stageHeight),
      finished: finish > 0 && row.height === finish,
    };
  });
  ranked.sort((a, b) => b.height - a.height || a.aspect - b.aspect);
  ranked.forEach((row, index) => {
    row.rank = index + 1;
  });
  return ranked;
}
