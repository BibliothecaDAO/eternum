import { exploreStaminaOf, type StaminaBar } from "@/lib/army-stamina/segments";
import {
  configManager,
  type ExpeditionRules,
  type GameActions,
  getBalance,
  getTroopResourceId,
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
import { type Direction, RESOURCE_PRECISION, ResourcesIds, TickIds, TroopTier, TroopType } from "@bibliothecadao/types";

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
 * the troops at home, the wheat each troop costs and the wheat the realm holds. Troops are one count; the troop
 * resource they are drawn from is the realm's own, never shown.
 */
interface DeployPlan {
  /** Today's open slots, lowest first, as the contract fills them. */
  open: SlotStart[];
  /** The slot the next army fills, or null when every slot today holds an army. */
  next: SlotStart | null;
  /** The troops at home the next army draws from; null when the realm holds none. */
  troops: { type: TroopType; tier: TroopTier; atHome: number; cap: number } | null;
  /** Whole wheat a troop costs to deploy (0 where deploying costs nothing). */
  wheatPerTroop: number;
  /** Whole wheat the realm holds. */
  wheat: number;
}

const TYPES = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin] as const;
const TIERS = [TroopTier.T1, TroopTier.T2, TroopTier.T3] as const;
const PRECISION = BigInt(RESOURCE_PRECISION);

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
  const wheat = getBalance(safeInteger(realm.entity_id), ResourcesIds.Wheat, defaultTick, store).balance;
  // A troop's price waits on the realm's research: the Barracks' Rations lowers it.
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (!open || wheat === undefined || learned === undefined) return undefined;
  const troops = readTroopsAtHome(store, realm, rules, clock);
  if (troops === undefined) return undefined;
  // A new army's Logistics starts at its realm's Supply yard tier, which raises the bar a fresh slot starts full at.
  const trained = researchTier(learned, research.ROW_SUPPLY_YARD);
  const perExplore = exploreStaminaOf(store, realm.game_id);
  const starts = open.map((slot) => slotStart(slot, troops, trained, clock.defaultTick, perExplore));
  return {
    open: starts,
    next: starts[0] ?? null,
    troops,
    wheatPerTroop: troops ? wheatToDeploy(store, realm, troops, 1, defaultTick) : 0,
    wheat: Number(BigInt(wheat) / PRECISION),
  };
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
  for (const tier of TIERS)
    for (const type of TYPES) {
      const stock = stocks.get(getTroopResourceId(type, tier))!;
      const atHome = stock.held + stock.fits;
      if (atHome > 0) return { type, tier, atHome, cap: configManager.getMaxArmySize(realm.base.level, tier) };
    }
  return null;
};

/** Whole wheat to deploy `count` troops, as the contract's raise charges it (rounded up). */
const wheatToDeploy = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  troops: NonNullable<DeployPlan["troops"]>,
  count: number,
  defaultTick: number,
): number => {
  const costs = readTroopRaiseCost(
    store,
    realm.game_id,
    safeInteger(realm.entity_id),
    getTroopResourceId(troops.type, troops.tier),
    count,
    defaultTick,
  );
  const wheat = costs?.find(({ resource }) => resource === ResourcesIds.Wheat)?.amount ?? 0n;
  return Math.ceil(Number(wheat) / RESOURCE_PRECISION);
};

/** The most one army can take: the troops at home, the castle's cap and the wheat, whichever runs out first. */
export const deployRange = (plan: DeployPlan): { troopsMax: number; wheatMax: number; max: number } => {
  if (!plan.troops) return { troopsMax: 0, wheatMax: 0, max: 0 };
  const troopsMax = Math.min(plan.troops.atHome, plan.troops.cap);
  const wheatMax = plan.wheatPerTroop > 0 ? Math.floor(plan.wheat / plan.wheatPerTroop) : troopsMax;
  return { troopsMax, wheatMax, max: Math.min(troopsMax, wheatMax) };
};

/** The army a count makes: the whole troops that go and what they cost in wheat. */
export const previewDeploy = (plan: DeployPlan, count: number): { count: number; wheatCost: number } => {
  const whole = Math.max(0, Math.min(Math.floor(count), deployRange(plan).max));
  return { count: whole, wheatCost: whole * plan.wheatPerTroop };
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
) =>
  actions.createExplorerArmy({
    structureId: safeInteger(realm.entity_id),
    troopType: troops.type,
    troopTier: troops.tier,
    troopCount: count,
    spawnDirection: direction,
  });
