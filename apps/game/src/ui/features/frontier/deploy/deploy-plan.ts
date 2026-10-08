import type { Tier } from "@/ui/design-system/kit/tier-chip";
import {
  computeTravelFoodCosts,
  configManager,
  type ExpeditionRules,
  type GameActions,
  getBalance,
  getTroopResourceId,
  readRevealPercent,
  readTroopRaiseCost,
  realmLearned,
  researchTier,
  revealYield,
} from "@bibliothecadao/eternum";
import { nativeResearchConstants, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { musterStamina, type OpenArmySlot, openArmySlots } from "@bibliothecadao/eternum/troop-stamina";
import { type Direction, RESOURCE_PRECISION, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";

import { stocksAtNextDeploy } from "../frontier-home";
import { sidesTaken } from "../research/sides-taken";

/**
 * What Deploy needs, read from facts with no UI of its own: the next open slot, the troops at home, the wheat each
 * troop costs and the wheat the realm holds. Troops are one count; the troop resource they are drawn from is the
 * realm's own, never shown.
 */
interface DeployPlan {
  /** The slot the next army fills, or null when every slot today holds an army. */
  next: OpenArmySlot | null;
  slots: { used: number; allowed: number };
  /** The troops at home the next army draws from; null when the realm holds none. */
  troops: { type: TroopType; tier: TroopTier; atHome: number; cap: number } | null;
  /** Whole wheat a troop costs to deploy (0 where deploying costs nothing). */
  wheatPerTroop: number;
  /** Whole wheat each troop eats a tile. */
  wheatPerTroopTile: number;
  /** Whole wheat the realm holds. */
  wheat: number;
  /** The Logistics tiers above common the realm's Supply yard gives every new army. */
  trainedLogistics: number;
  /** The tiers the realm's four training buildings start a new army at. */
  startingTiers: StartingTiers;
  /** The Barracks row has taken Rations: each troop deploys for less wheat. */
  rations: boolean;
}

type StartingTiers = readonly [Tier, Tier, Tier, Tier];

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
  const wheat = getBalance(realm.entity_id, ResourcesIds.Wheat, defaultTick, store).balance;
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  if (!open || wheat === undefined || learned === undefined) return undefined;
  const troops = readTroopsAtHome(store, realm, rules, clock);
  if (troops === undefined) return undefined;
  return {
    next: open[0] ?? null,
    slots: { used: allowed - open.length, allowed },
    troops,
    wheatPerTroop: troops ? wheatToDeploy(store, realm, troops, 1, defaultTick) : 0,
    wheatPerTroopTile: troops
      ? Math.abs(computeTravelFoodCosts({ category: troops.type, count: PRECISION }).wheatPayAmount)
      : 0,
    wheat: Number(BigInt(wheat) / PRECISION),
    trainedLogistics: researchTier(learned, nativeResearchConstants.ROW_SUPPLY_YARD),
    startingTiers: startingTiers(learned),
    rations: sidesTaken(learned, nativeResearchConstants.ROW_BARRACKS).includes("Ra"),
  };
};

/** The tiers a new army starts at, as progression.cairo's starting tiers read the training rows, in the attributes' order. */
const startingTiers = (learned: bigint): StartingTiers => {
  const tier = (row: number) => (researchTier(learned, row) + 1) as Tier;
  return [
    tier(nativeResearchConstants.ROW_WAR_HALL),
    tier(nativeResearchConstants.ROW_SUPPLY_YARD),
    tier(nativeResearchConstants.ROW_SCOUTS_LODGE),
    tier(nativeResearchConstants.ROW_HEARTH),
  ];
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
    realm.entity_id,
    getTroopResourceId(troops.type, troops.tier),
    count,
    defaultTick,
  );
  const wheat = costs?.find(({ resource }) => resource === ResourcesIds.Wheat)?.amount ?? 0n;
  return Math.ceil(Number(wheat) / RESOURCE_PRECISION);
};

/** The slider's ends: one troop (a scout), and the most one army can take: troops at home, the castle's cap, the wheat. */
export const deployRange = (plan: DeployPlan): { troopsMax: number; wheatMax: number; max: number } => {
  if (!plan.troops) return { troopsMax: 0, wheatMax: 0, max: 0 };
  const troopsMax = Math.min(plan.troops.atHome, plan.troops.cap);
  const wheatMax = plan.wheatPerTroop > 0 ? Math.floor(plan.wheat / plan.wheatPerTroop) : troopsMax;
  return { troopsMax, wheatMax, max: Math.min(troopsMax, wheatMax) };
};

/**
 * The army a count makes: what it costs in wheat, the wheat left, how many tiles that wheat moves it, what each reveal
 * sends home and the stamina it starts with.
 */
export const previewDeploy = (
  store: NativeFactStore,
  gameId: number,
  plan: DeployPlan,
  count: number,
  armiesTick: number,
): {
  count: number;
  wheatCost: number;
  wheatLeft: number;
  tiles: number;
  revealYield: bigint | undefined;
  stamina: { amount: number; max: number } | null;
} => {
  const whole = Math.max(0, Math.min(Math.floor(count), deployRange(plan).max));
  const wheatCost = whole * plan.wheatPerTroop;
  const wheatLeft = Math.max(0, plan.wheat - wheatCost);
  const perTile = whole * plan.wheatPerTroopTile;
  const { troop_limit_config: limits, troop_stamina_config: staminaRules } = configManager.getTroopConfig();
  // A new army starts on land.
  const percent = readRevealPercent(store, gameId, 0);
  const troops = plan.troops;
  return {
    count: whole,
    wheatCost,
    wheatLeft,
    tiles: perTile > 0 ? Math.floor(wheatLeft / perTile) : 0,
    revealYield:
      percent === undefined || !troops
        ? undefined
        : revealYield({ tier: troops.tier, count: BigInt(whole) * PRECISION }, limits, percent),
    stamina:
      plan.next && troops
        ? musterStamina(
            plan.next,
            { category: troops.type, tier: troops.tier },
            armiesTick,
            staminaRules,
            plan.trainedLogistics,
          )
        : null,
  };
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
): Promise<void> =>
  actions.createExplorerArmy({
    structureId: realm.entity_id,
    troopType: troops.type,
    troopTier: troops.tier,
    troopCount: count,
    spawnDirection: direction,
  });
