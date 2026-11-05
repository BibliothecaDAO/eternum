import { exploreStaminaOf } from "@/lib/army-stamina/explore-stamina";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import {
  configManager,
  type ExpeditionRules,
  type GameActions,
  getBalance,
  getTroopResourceId,
  canPayTroopRaise,
  readTroopRaiseCost,
  realmLearned,
  researchTier,
} from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  safeInteger,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { musterStamina, type OpenArmySlot, openArmySlots } from "@bibliothecadao/eternum/troop-stamina";
import {
  type Direction,
  RESOURCE_PRECISION,
  ResourcesIds,
  TickIds,
  TROOP_TIERS,
  TROOP_TYPES,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

import { stocksAtNextDeploy } from "../frontier-home";

/**
 * An open army slot and the stamina a new army starts on in it (the owner, 20 October 2026: "stamina is slot tied"):
 * full at its own maximum when the slot is fresh today, else the bar the slot's last army left, recovering since.
 * Its army's number is the slot's, counted from one, as the dock and the map plate number armies.
 */
export interface SlotStart {
  slot: number;
  number: number;
  /** Whether the slot's bar was left by an army today; a fresh slot starts full. */
  inherited: boolean;
  /** The bar the army starts on, under the game's rules; unknown while the troops it would take are. */
  start: StaminaBar | undefined;
}

/**
 * What Deploy needs, read from facts with no UI of its own: the open slots and the bar each would start an army on,
 * the troops at home and what raising them costs. Troops are one count; the troop resource they are drawn from is the
 * realm's own, never shown.
 */
interface DeployPlan {
  /** Today's open slots, in slot order, for the player to choose from. */
  open: SlotStart[];

  /** The troops at home the next army draws from; null when the realm holds none. */
  troops: { type: TroopType; tier: TroopTier; atHome: number; cap: number } | null;
  /** What raising the troops at home costs; null when the realm holds none. */
  raise: TroopRaise | null;
}

/**
 * What raising troops costs a realm, a new army's or an army's beside it, priced as the contract's raise_troops prices
 * the whole batch (readTroopRaiseCost): Rations' cut counted on the batch, never one troop's price rounded and
 * multiplied.
 */
export interface TroopRaise {
  /** The wheat the realm holds, exact. */
  wheat: number;
  /** The wheat a batch of `count` troops costs, exact. */
  wheatFor: (count: number) => number;
  /** The most troops, up to the most that could go, whose raise the realm can pay. */
  paysFor: number;
}

/**
 * The realm's deploy today; unknown while any slot, troop or wheat balance, or the realm's research, is. Troops at home
 * are what this deploy finds: the stock and Homecoming's return from the armies whose day has ended, as much as fits.
 */
export const readDeployPlan = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  clock: { now: number; defaultTick: number },
): DeployPlan | undefined => {
  const { defaultTick } = clock;
  const allowed = realm.base.troop_max_explorer_count;
  const open = openArmySlots(store, { game_id: realm.game_id, entity_id: realm.entity_id, allowedSlots: allowed });
  // A troop's price waits on the realm's research: the Barracks' Rations lowers it.
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (!open || learned === undefined) return undefined;
  const troops = readTroopsAtHome(store, realm, rules, clock);
  if (troops === undefined) return undefined;
  const raise = troops && readTroopRaise(store, realm, troops, Math.min(troops.atHome, troops.cap), defaultTick);
  if (raise === undefined) return undefined;
  // A new army's Logistics starts at its realm's Supply yard tier, which raises the bar a fresh slot starts full at.
  const trained = researchTier(learned, research.ROW_SUPPLY_YARD);
  const perExplore = exploreStaminaOf(store, realm.game_id);
  const starts = open.map((slot) => slotStart(slot, troops, trained, clock.defaultTick, perExplore));
  return { open: starts, troops, raise };
};

/** One open slot's start, through the core's one rule for it (musterStamina), on the dock's clock. */
const slotStart = (
  slot: OpenArmySlot,
  troops: DeployPlan["troops"],
  trained: number,
  timestamp: number,
  perExplore: number,
): SlotStart => {
  const bar =
    troops &&
    musterStamina(
      slot,
      { category: troops.type, tier: troops.tier },
      timestamp,
      configManager.getTroopStaminaRules(),
      trained,
      Number(configManager.getTick(TickIds.Armies)),
    );
  return {
    slot: slot.slot,
    number: slot.slot + 1,
    inherited: slot.inherited !== null,
    start: bar ? { current: bar.amount, max: bar.max, perExplore } : undefined,
  };
};

/**
 * The troops at home: the first stack this deploy finds, Homecoming's fitting return included, with the castle's cap
 * on one army. Undefined while unknown.
 */
const readTroopsAtHome = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  clock: { now: number; defaultTick: number },
): DeployPlan["troops"] | undefined => {
  const stocks = stocksAtNextDeploy(store, realm, rules, clock.now, clock.defaultTick);
  if (!stocks) return undefined;
  for (const tier of TROOP_TIERS)
    for (const type of TROOP_TYPES) {
      const stock = stocks.get(getTroopResourceId(type, tier))!;
      const atHome = stock.held + stock.fits;
      if (atHome > 0) return { type, tier, atHome, cap: configManager.getMaxArmySize(realm.base.level, tier) };
    }
  return null;
};

/** What raising up to `most` troops of a kind costs the realm today; unknown while a balance it pays from is. */
export const readTroopRaise = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  troops: { type: TroopType; tier: TroopTier },
  most: number,
  defaultTick: number,
): TroopRaise | undefined => {
  const realmId = safeInteger(realm.entity_id);
  const troop = getTroopResourceId(troops.type, troops.tier);
  const priceOf = (count: number) => readTroopRaiseCost(store, realm.game_id, realmId, troop, count, defaultTick);
  const wheat = getBalance(realmId, ResourcesIds.Wheat, defaultTick, store).balance;
  if (wheat === undefined || priceOf(0) === undefined) return undefined;
  const wheatOf = (count: number) => priceOf(count)?.find(({ resource }) => resource === ResourcesIds.Wheat)?.amount;
  return {
    wheat: Number(wheat) / RESOURCE_PRECISION,
    wheatFor: (count) => Number(wheatOf(count) ?? 0n) / RESOURCE_PRECISION,
    paysFor: mostThatPays(most, (count) => canPayTroopRaise(priceOf(count))),
  };
};

/** The largest count from 0 to `most` that `pays`, which pays for every count below one it pays for. */
const mostThatPays = (most: number, pays: (count: number) => boolean): number => {
  let [low, high] = [0, Math.max(0, most)];
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (pays(middle)) low = middle;
    else high = middle - 1;
  }
  return low;
};

/** How many troops could go by what is home and fits, how many their raise pays for, and the fewer of the two. */
export interface TroopRange {
  troopsMax: number;
  wheatMax: number;
  max: number;
}

/** The most one army can take: the troops at home, the castle's cap and the wheat, whichever runs out first. */
export const deployRange = (plan: DeployPlan): TroopRange =>
  plan.troops && plan.raise
    ? troopRange(Math.min(plan.troops.atHome, plan.troops.cap), plan.raise)
    : { troopsMax: 0, wheatMax: 0, max: 0 };

/** The troops that could go, held to what their raise pays for. */
export const troopRange = (troopsMax: number, raise: TroopRaise): TroopRange => {
  const wheatMax = Math.min(troopsMax, raise.paysFor);
  return { troopsMax, wheatMax, max: wheatMax };
};

/**
 * Where the wheat is what stops the count: the count is at the most and the wheat pays for fewer troops than would go
 * without it. Then the troops it pays for, of how many; else none, and the sheet names no wheat (owner, 1 November: "I
 * should only see the wheat warning when I deploy the max, not at 0"). A count of 0 is at the most only where the wheat
 * pays for no troop, the one 0 the wheat explains (owner, the same day).
 */
export const wheatStopsAt = (range: TroopRange, count: number): { troops: number; of: number } | undefined =>
  count === range.max && range.wheatMax < range.troopsMax ? { troops: range.max, of: range.troopsMax } : undefined;

/** The army a count makes: the whole troops that go and what they cost in wheat. */
export const previewDeploy = (plan: DeployPlan, count: number): { count: number; wheatCost: number } => {
  const whole = Math.max(0, Math.min(Math.floor(count), deployRange(plan).max));
  return { count: whole, wheatCost: plan.raise?.wheatFor(whole) ?? 0 };
};

/**
 * The tile the army deploys onto: the one the player picked while it stays open, else the first open tile of the
 * ring; none while no tile is known to be open.
 */
export const deployDirection = (
  ring: readonly { direction: Direction; open: boolean }[],
  picked: Direction | null,
): Direction | null =>
  ring.find((tile) => tile.open && tile.direction === picked)?.direction ??
  ring.find((tile) => tile.open)?.direction ??
  null;

/** The Deploy command: this many troops at home, stepping out where the realm has room. */
export const deployArmy = (
  actions: Pick<GameActions, "createExplorerArmy">,
  realm: NativeRows["Structure"],
  troops: NonNullable<DeployPlan["troops"]>,
  count: number,
  direction: Direction,
  slot: number,
) =>
  actions.createExplorerArmy({
    structureId: safeInteger(realm.entity_id),
    troopType: troops.type,
    troopTier: troops.tier,
    troopCount: count,
    spawnDirection: direction,
    slot,
  });
