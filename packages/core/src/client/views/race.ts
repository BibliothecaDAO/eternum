import { aspects } from "@bibliothecadao/types";
import { nativeRaceConstants, type NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import { readDeepSites } from "./deep-sites";

export const RACE_MODELS = [
  "RaceRules", "RaceMember", "AspectHyperstructure", "TriumphDay", "RaceResult", "HomeAspect", "AspectMembers",
  "Structure", "EntityName", "GameRegistry", "AltarBar", "DeepRules", "DeepSite", "DeepGuard", "DeepArmy", "ArmyDay", "ExplorerTroops",
] as const;

export interface RaceBoard {
  rules: NativeRows["RaceRules"];
  result: NativeRows["RaceResult"] | null;
  standings: (NativeRows["AspectHyperstructure"] & { rank: number; stage: number; finished: boolean })[];
  own: {
    aspect: number;
    triumphs: { stage: number; day: bigint | null }[];
    bar: { charge: number; threshold: number };
    members: {
      home: NativeRows["Structure"];
      glory: bigint;
      contribution: bigint;
      mine: boolean;
      guards: string[];
    }[];
  } | null;
}

/** A fixed race monument's identity is published with its height, shared across every player's map. */
export function readRaceMonument(store: NativeFactStore, gameId: number, entityId: number | bigint) {
  return [...store.inGame("AspectHyperstructure", gameId)].find((row) => row.entity_id === BigInt(entityId));
}

/** Null means the preset has no race; incomplete native facts never become zero Glory or an empty leaderboard. */
export function readRaceBoard(
  store: NativeFactStore,
  gameId: number,
  home: bigint | null,
  timestamp: number,
): NativeFactResult<{ race: RaceBoard | null }> {
  const complete = store.absenceKnown("RaceRules", { game_id: gameId });
  if (!complete.known) return complete;
  const rules = store.get("RaceRules", { game_id: gameId });
  if (!rules) return { known: { race: null } };
  const standings: RaceBoard["standings"] = [];
  const finish = rules.stage_height * nativeRaceConstants.STAGE_COUNT;
  for (const aspect of aspects) {
    const row = store.get("AspectHyperstructure", { game_id: gameId, aspect: aspect.id });
    if (!row) return { unknown: "MISSING_ASPECT_HYPERSTRUCTURE" };
    if (row.height > finish) throw new Error("Race height exceeds its finish");
    standings.push({
      ...row, rank: 0, stage: Math.min(nativeRaceConstants.STAGE_COUNT, Math.floor(row.height / rules.stage_height) + 1),
      finished: row.height === finish,
    });
  }
  standings.sort((a, b) => b.height - a.height || a.aspect - b.aspect);
  standings.forEach((row, index) => { row.rank = index + 1; });
  const own = readOwnAspect(store, gameId, home, timestamp);
  if (!own.known) return own;
  return { known: { race: { rules, standings, result: store.get("RaceResult", { game_id: gameId }) ?? null, own: own.known.own } } };
}

function readOwnAspect(
  store: NativeFactStore, gameId: number, home: bigint | null, timestamp: number,
): NativeFactResult<{ own: RaceBoard["own"] }> {
  if (home === null) return { known: { own: null } };
  const membership = store.get("HomeAspect", { game_id: gameId, home });
  if (!membership) return { unknown: "MISSING_HOME_ASPECT" };
  const { aspect } = membership;
  const count = store.get("AspectMembers", { game_id: gameId, aspect });
  const memberships = [...store.inGame("HomeAspect", gameId)].filter((row) => row.aspect === aspect);
  if (!count || memberships.length !== count.members) return { unknown: "INCOMPLETE_ASPECT_MEMBERS" };
  const members: NonNullable<RaceBoard["own"]>["members"] = [];
  const sites = readDeepSites(store, timestamp, gameId);
  for (const row of memberships) {
    const structure = store.get("Structure", { game_id: gameId, entity_id: row.home });
    if (!structure) return { unknown: "MISSING_ASPECT_MEMBER_HOME" };
    const member = store.requireOrAbsent("RaceMember", { game_id: gameId, entity_id: row.home });
    if (!member.known) return member;
    members.push({
      home: structure, glory: member.known.glory, contribution: member.known.contribution, mine: row.home === home,
      guards: sites.filter((site) => site.guards.some(({ army }) => army.owner === row.home)).map((site) => site.name),
    });
  }
  members.sort((a, b) => a.glory === b.glory ? (a.home.entity_id < b.home.entity_id ? -1 : 1) : a.glory > b.glory ? -1 : 1);
  const triumphs = Array.from({ length: nativeRaceConstants.STAGE_COUNT - 1 }, (_, index) => {
    const stage = index + 1;
    return { stage, day: store.get("TriumphDay", { game_id: gameId, aspect, stage })?.day ?? null };
  });
  const bar = store.requireOrAbsent("AltarBar", { game_id: gameId, aspect });
  if (!bar.known) return bar;
  const deep = store.get("DeepRules", { game_id: gameId });
  if (!deep) return { unknown: "MISSING_DEEP_RULES" };
  return { known: { own: { aspect, members, triumphs, bar: { charge: bar.known.charge, threshold: deep.altar_threshold } } } };
}
