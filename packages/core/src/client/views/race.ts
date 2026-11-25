import { aspects, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { type NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { nativeRaceConstants } from "../../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";

export const RACE_MODELS = [
  "RaceRules",
  "RaceMember",
  "AspectHyperstructure",
  "RaceResult",
  "HomeAspect",
  "AspectMembers",
  "Structure",
  "EntityName",
  "GameRegistry",
  "AltarBar",
  "DeepRules",
] as const;

export interface RaceBoard {
  rules: NativeRows["RaceRules"];
  result: NativeRows["RaceResult"] | null;
  standings: (NativeRows["AspectHyperstructure"] & { rank: number; stage: number; finished: boolean })[];
  own: {
    aspect: number;
    bar: { charge: number; threshold: number };
    members: {
      home: NativeRows["Structure"];
      glory: bigint;
      contribution: bigint;
      mine: boolean;
    }[];
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
  const own = readOwnAspect(store, gameId, home);
  if (!own.known) return own;
  return {
    known: {
      race: { rules, standings, result: store.get("RaceResult", { game_id: gameId }) ?? null, own: own.known.own },
    },
  };
}

function readOwnAspect(
  store: NativeFactStore,
  gameId: number,
  home: bigint | null,
): NativeFactResult<{ own: RaceBoard["own"] }> {
  if (home === null) return { known: { own: null } };
  const membership = store.get("HomeAspect", { game_id: gameId, home });
  if (!membership) return { unknown: "MISSING_HOME_ASPECT" };
  const { aspect } = membership;
  const count = store.get("AspectMembers", { game_id: gameId, aspect });
  const memberships = [...store.inGame("HomeAspect", gameId)].filter((row) => row.aspect === aspect);
  if (!count || memberships.length !== count.members) return { unknown: "INCOMPLETE_ASPECT_MEMBERS" };
  const members: NonNullable<RaceBoard["own"]>["members"] = [];
  for (const row of memberships) {
    const structure = store.get("Structure", { game_id: gameId, entity_id: row.home });
    if (!structure) return { unknown: "MISSING_ASPECT_MEMBER_HOME" };
    const member = store.requireOrAbsent("RaceMember", { game_id: gameId, entity_id: row.home });
    if (!member.known) return member;
    members.push({
      home: structure,
      glory: member.known.glory,
      contribution: member.known.contribution,
      mine: row.home === home,
    });
  }
  members.sort((a, b) =>
    compareAspectMembers({ glory: a.glory, home: a.home.entity_id }, { glory: b.glory, home: b.home.entity_id }),
  );
  const bar = store.requireOrAbsent("AltarBar", { game_id: gameId, aspect });
  if (!bar.known) return bar;
  const deep = store.get("DeepRules", { game_id: gameId });
  if (!deep) return { unknown: "MISSING_DEEP_RULES" };
  return {
    known: { own: { aspect, members, bar: { charge: bar.known.charge, threshold: deep.altar_threshold } } },
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
