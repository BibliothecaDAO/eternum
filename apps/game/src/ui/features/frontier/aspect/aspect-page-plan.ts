import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import {
  getStructureName,
  isViewerOwner,
  readAspectRace,
  readDeepSites,
  type AspectRace,
  type AspectStanding,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { type AspectId, RESOURCE_PRECISION } from "@bibliothecadao/types";

/** The four stages whose completion gives the whole Aspect a Triumph the next day, first to fourth (C17). */
const TRIUMPH_STAGES = [
  nativeRuleConstants.CLEAR_MIST_STAGE,
  nativeRuleConstants.SECOND_WIND_STAGE,
  nativeRuleConstants.PALE_MOON_STAGE,
  nativeRuleConstants.SPOILS_STAGE,
] as const;
export type TriumphStage = (typeof TRIUMPH_STAGES)[number];

/** A member of the viewer's Aspect: its home's realm, its Glory, and the Deep site one of its armies guards today. */
export type AspectMember = { home: bigint; realm: string; glory: number; guards: string | null; mine: boolean };

/** The viewer's own Aspect: its place in the race, its Triumphs, its bane bar and its members by Glory. */
export type OwnAspect = {
  aspect: AspectId;
  standing: AspectStanding;
  /** Each Triumph stage and the game day its Triumph fell on; null for a stage not built yet. */
  triumphs: { stage: TriumphStage; day: number | null }[];
  /** The bar its Altar ticks fill, and the charge that issues a team bane; null in a game without the Deep. */
  bar: { charge: number; threshold: number } | null;
  members: AspectMember[];
};

export type AspectPagePlan = { kind: "reading" } | { kind: "page"; race: AspectRace; own: OwnAspect | null };

/**
 * The Aspect page, read from the game's facts at `timestamp`: the race of the four hyperstructures, and the viewer's own
 * Aspect when `home` (the viewer's realm) has joined one. Reading while the race is not known yet; null in a game with
 * no race, whose Season place keeps its board.
 */
export const readAspectPage = (
  store: NativeFactStore,
  gameId: number,
  home: bigint | null,
  viewer: Parameters<typeof isViewerOwner>[1],
  timestamp: number,
): AspectPagePlan | null => {
  const race = readAspectRace(store, gameId);
  if (race === null) return null;
  // A member's Glory and a bane bar read as zero where their row is absent, which only a complete snapshot proves.
  if (race === undefined || !store.subscriptionScope().known) return { kind: "reading" };
  const joined = home === null ? undefined : store.get("HomeAspect", { game_id: gameId, home });
  return {
    kind: "page",
    race,
    own: joined ? readOwnAspect(store, gameId, race, joined.aspect as AspectId, viewer, timestamp) : null,
  };
};

const readOwnAspect = (
  store: NativeFactStore,
  gameId: number,
  race: AspectRace,
  aspect: AspectId,
  viewer: Parameters<typeof isViewerOwner>[1],
  timestamp: number,
): OwnAspect => ({
  aspect,
  standing: race.standings.find((standing) => standing.aspect === aspect)!,
  triumphs: TRIUMPH_STAGES.map((stage) => {
    const fell = store.get("TriumphDay", { game_id: gameId, aspect, stage });
    return { stage, day: fell ? Number(fell.day) : null };
  }),
  bar: baneBar(store, gameId, aspect),
  members: readMembers(store, gameId, aspect, viewer, timestamp),
});

/** Its members by Glory, most first: every home that joined it, with the site one of its armies guards today. */
const readMembers = (
  store: NativeFactStore,
  gameId: number,
  aspect: AspectId,
  viewer: Parameters<typeof isViewerOwner>[1],
  timestamp: number,
): AspectMember[] => {
  const guarding = new Map<bigint, string>();
  for (const site of readDeepSites(store, timestamp))
    for (const { army } of site.guards) guarding.set(army.owner, site.name);
  return [...store.inGame("HomeAspect", gameId)]
    .filter((row) => row.aspect === aspect)
    .map(({ home: entity }) => {
      const home = store.require("Structure", { game_id: gameId, entity_id: entity });
      return {
        home: entity,
        realm: getStructureName(home, store).name,
        glory: gloryOf(store, gameId, entity),
        guards: guarding.get(entity) ?? null,
        mine: isViewerOwner(home.owner, viewer),
      };
    })
    .sort((a, b) => b.glory - a.glory || Number(a.home - b.home));
};

/** A home's Glory in whole units: zero before it has held a Glory site, as RaceMember declares. */
const gloryOf = (store: NativeFactStore, gameId: number, home: bigint): number => {
  const member = store.requireOrAbsent("RaceMember", { game_id: gameId, entity_id: home });
  if (member.known === undefined) throw new Error(`RaceMember of home ${home}: ${member.unknown}`);
  return Number(member.known.glory / BigInt(RESOURCE_PRECISION));
};

/** The Aspect's bane bar against the charge that issues a team bane; none in a game without the Deep. */
const baneBar = (store: NativeFactStore, gameId: number, aspect: AspectId): OwnAspect["bar"] => {
  const rules = store.get("DeepRules", { game_id: gameId });
  return rules ? { charge: altarCharge(store, gameId, aspect), threshold: rules.altar_threshold } : null;
};

/** An Aspect's bane bar now: zero before it has held the Altar, as AltarBar declares. */
export const altarCharge = (store: NativeFactStore, gameId: number, aspect: number): number => {
  const bar = store.requireOrAbsent("AltarBar", { game_id: gameId, aspect });
  if (bar.known === undefined) throw new Error(`AltarBar of Aspect ${aspect}: ${bar.unknown}`);
  return bar.known.charge;
};
