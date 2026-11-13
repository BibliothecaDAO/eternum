import {
  currentArmy,
  deepTicksLeft,
  getStructureName,
  isViewerOwner,
  readDeepSites,
  type DeepSiteView,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { deepSites, getNeighborHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";

import { altarCharge } from "../aspect/aspect-page-plan";

/** One of a held site's four slots: the army in it, its player's realm, and what it holds of each tick. */
export type DeepSlot = {
  slot: number;
  armyId: bigint;
  realm: string;
  /** Its troops now, the Deep's losses taken. */
  troops: number;
  /** The army ticks it has left, and the seconds until the last of them. */
  ticks: { left: number; seconds: number };
  /** Its share of each tick, out of 100: its troops over the guard's. */
  share: number;
  /** The slot is the viewer's own army. */
  mine: boolean;
};

/** What one tick held pays the site's guards, split among them by troops (deep_ticks.cairo, race.cairo pay_tick). */
export type DeepTickPay = {
  glory: number;
  /** Height added to the holder Aspect's hyperstructure: the Foundation's. */
  height: number;
  /** Labor, and the same of Essence, to the guards' realms: the Quarry's. */
  resources: number;
  /** Charge added to the holder Aspect's bane bar, its charge now and the charge that issues a bane: the Altar's. */
  bar: { perTick: number; charge: number; threshold: number } | null;
};

/**
 * Who stands on the site today: its beast; its guards with their Aspect, in the order an attacker fights them (the
 * highest slot first, as guards.cairo `next` takes a structure's) and the one it meets next; or nobody once they are gone.
 */
export type DeepGuardState =
  | { kind: "beast"; troops: number }
  | { kind: "held"; aspect: number; slots: DeepSlot[]; next: bigint }
  | { kind: "open" };

/**
 * What the selected army can do at the site, as the contract takes it (deep_sites.cairo `battle_beast`,
 * deep_guards.cairo `join`): attack the beast; take the open site or join its own Aspect's guard (InteractSite); or why
 * it cannot. In reach or not is the card's: away, the same step is Move.
 */
export type DeepStep =
  | { kind: "attack"; stamina: number }
  | { kind: "take" }
  | { kind: "join" }
  | { kind: "guarding" }
  | { kind: "full" }
  | { kind: "rival" }
  | { kind: "other-day" }
  | { kind: "no-troops" };

export type DeepSiteCardPlan =
  | { kind: "reading" }
  | {
      kind: "site";
      site: DeepSiteView;
      pay: DeepTickPay;
      guard: DeepGuardState;
      /** The selected army's step; null with no army of the player's selected. */
      step: DeepStep | null;
      /** The selected army stands beside the site, where the contract takes its order. */
      inReach: boolean;
    };

/** The army the card acts with: the player's selected army, as the store holds it, and its tile. */
export type DeepActor = { army: NativeRows["ExplorerTroops"]; tile: { col: number; row: number } };

/** The player reading the card, as isViewerOwner takes it. */
type Viewer = Parameters<typeof isViewerOwner>[1];

/**
 * The Deep site standing on `tile`, read for its card at `timestamp`: what a tick pays, who guards it and what
 * `actor` can do there. Reading while the snapshot is incomplete, when a missing row proves nothing; null when no Deep
 * site stands on the tile.
 */
export const readDeepSiteCard = (
  store: NativeFactStore,
  gameId: number,
  tile: { col: number; row: number },
  actor: DeepActor | null,
  viewer: Viewer,
  timestamp: number,
): DeepSiteCardPlan | null => {
  if (!store.subscriptionScope().known) return { kind: "reading" };
  const site = readDeepSites(store, timestamp).find(
    ({ position }) => position.x === tile.col && position.y === tile.row,
  );
  if (!site) return null;
  const guard = readGuard(store, site, viewer, timestamp);
  return {
    kind: "site",
    site,
    pay: readTickPay(store, gameId, site, guard),
    guard,
    step: actor ? deepStep(store, site, guard, actor, timestamp) : null,
    inReach: actor !== null && besideSite(actor.tile, tile),
  };
};

const readGuard = (store: NativeFactStore, site: DeepSiteView, viewer: Viewer, timestamp: number): DeepGuardState => {
  if (site.beastTroops > 0n) return { kind: "beast", troops: troopsOf(site.beastTroops) };
  if (site.guards.length === 0) return { kind: "open" };
  const shares = sharesOfTick(site.guards.map(({ army }) => army));
  const slots = site.guards.map(({ slot, army }) => {
    const home = store.require("Structure", { game_id: army.game_id, entity_id: army.owner });
    const stored = store.require("ExplorerTroops", { game_id: army.game_id, explorer_id: army.explorer_id });
    const ticks = deepTicksLeft(store, stored, timestamp);
    if (!ticks) throw new Error(`Deep guard ${army.explorer_id} has no Deep tick`);
    return {
      slot,
      armyId: army.explorer_id,
      realm: getStructureName(home, store).name,
      troops: troopsOf(army.troops.count),
      ticks,
      share: shares.get(army.explorer_id)!,
      mine: isViewerOwner(home.owner, viewer),
    };
  });
  const fought = slots.toSorted((a, b) => b.slot - a.slot);
  return { kind: "held", aspect: homeAspect(store, site.guards[0]!.army), slots: fought, next: fought[0]!.armyId };
};

const readTickPay = (
  store: NativeFactStore,
  gameId: number,
  site: DeepSiteView,
  guard: DeepGuardState,
): DeepTickPay => {
  const deep = store.require("DeepRules", { game_id: gameId });
  const race = store.require("RaceRules", { game_id: gameId });
  const glory = Number(race.glory_per_tick);
  const pays: Record<(typeof deepSites)[number]["position"], () => DeepTickPay> = {
    foundation: () => ({ glory, height: race.height_per_tick, resources: 0, bar: null }),
    quarry: () => ({ glory: 0, height: 0, resources: troopsOf(deep.quarry_per_tick), bar: null }),
    altar: () => ({
      glory,
      height: 0,
      resources: 0,
      bar: {
        perTick: deep.altar_per_tick,
        charge: guard.kind === "held" ? altarCharge(store, gameId, guard.aspect) : 0,
        threshold: deep.altar_threshold,
      },
    }),
  };
  return pays[siteOf(site).position]();
};

/** The site's entry in the Deep's catalog, by its kind. */
export const siteOf = (site: Pick<DeepSiteView, "kind">) => {
  const entry = deepSites.find(({ id }) => id === site.kind);
  if (!entry) throw new Error(`Unknown Deep site kind ${site.kind}`);
  return entry;
};

/** What the actor can do here, by the contract's own checks in its order. */
const deepStep = (
  store: NativeFactStore,
  site: DeepSiteView,
  guard: DeepGuardState,
  actor: DeepActor,
  timestamp: number,
): DeepStep => {
  const day = store.get("ArmyDay", { game_id: actor.army.game_id, explorer_id: actor.army.explorer_id });
  if (!day || Number(day.day) !== site.day) return { kind: "other-day" };
  // Its troops now, the Deep's losses taken: an army the ticks have emptied can do nothing here.
  if (currentArmy(store, actor.army, timestamp).troops.count === 0n) return { kind: "no-troops" };
  if (guard.kind === "beast")
    return {
      kind: "attack",
      stamina: store.require("SliceRules", { game_id: actor.army.game_id }).troop_stamina_config.stamina_attack_req,
    };
  if (guard.kind === "open") return { kind: "take" };
  if (homeAspect(store, actor.army) !== guard.aspect) return { kind: "rival" };
  const player = store.require("Structure", { game_id: actor.army.game_id, entity_id: actor.army.owner }).owner;
  const guarding = site.guards.some(
    ({ army }) => store.require("Structure", { game_id: army.game_id, entity_id: army.owner }).owner === player,
  );
  if (guarding) return { kind: "guarding" };
  return guard.slots.length >= nativeRuleConstants.DEEP_GUARD_SLOTS ? { kind: "full" } : { kind: "join" };
};

const homeAspect = (store: NativeFactStore, army: NativeRows["ExplorerTroops"]): number =>
  store.require("HomeAspect", { game_id: army.game_id, home: army.owner }).aspect;

/**
 * Each guard's share of a tick, out of 100, rounded so the shares make 100: each takes its whole percent, and the
 * percents left go to the largest remainders, ties to the lower slot (the contract splits the exact amount itself).
 */
const sharesOfTick = (armies: { explorer_id: bigint; troops: { count: bigint } }[]): Map<bigint, number> => {
  const total = armies.reduce((sum, army) => sum + army.troops.count, 0n);
  const exact = armies.map((army) => ({ id: army.explorer_id, tenths: (army.troops.count * 100_000n) / total }));
  const whole = exact.map(({ id, tenths }) => ({ id, share: Number(tenths / 1000n), rest: tenths % 1000n }));
  let left = 100 - whole.reduce((sum, { share }) => sum + share, 0);
  for (const each of whole.toSorted((a, b) => (a.rest === b.rest ? 0 : a.rest > b.rest ? -1 : 1))) {
    if (left <= 0) break;
    each.share += 1;
    left -= 1;
  }
  return new Map(whole.map(({ id, share }) => [id, share]));
};

const besideSite = (from: { col: number; row: number }, site: { col: number; row: number }): boolean =>
  getNeighborHexes(site.col, site.row).some(({ col, row }) => col === from.col && row === from.row);

const troopsOf = (count: bigint): number => Number(count / BigInt(RESOURCE_PRECISION));
