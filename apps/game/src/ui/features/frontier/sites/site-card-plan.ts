import { fallenRealmBeast } from "@/three/structures/fallen-realm";
import {
  activeCombatRules,
  configManager,
  expeditionDepth,
  forecastFight,
  getBlockTimestamp,
  ResourceManager,
  getGuardsByStructure,
  readExpeditionRules,
  siteKindOf,
  siteReward,
  type SiteKind,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import {
  type BiomeType,
  getLayeredAttackDistance,
  getTroopAttackRange,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  type Troops,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** An army about to attack a site, and the moment it would: everything the exchange depends on beyond the facts. */
export interface SiteAttack {
  army: NativeRows["ExplorerTroops"];
  armyTile: { col: number; row: number; alt: boolean };
  /** The site tile's biome, which both sides fight on. */
  biome: BiomeType;
  timestamp: number;
  armiesTick: number;
}

/**
 * What Frontier's tile card shows of a site (wireframe 06), read from facts with no UI of its own: its kind and name
 * (a ruin by its beast), its guard as troops and tier (never strength), what clearing it pays, the attack's stamina, and the whole
 * fight from the army in reach as exact exchanges. The guard's count is unknown until its slots arrive; a fight only
 * exists for an army in reach.
 */
export interface SiteCardPlan {
  name: string;
  guard: { type: TroopType; tier: TroopTier; count: number } | null | undefined;
  kind: SiteKind;
  xp: number;
  /** A ruin's stored tier and whole LORDS; unknown until its chest fact arrives. */
  chest: { tier: number; amount: number } | null | undefined;
  /**
   * Whole units paid home and what fits beside what the store holds; null for XP-only sites, undefined until the home's
   * facts arrive.
   */
  payout: { resourceId: ResourcesIds; amount: number; fits: number } | null | undefined;
  attackStamina: number;
  fight: SiteFight | undefined;
}

export type SiteFight =
  | { outcome: "refused" }
  | { outcome: "wins" | "loses" | "stalls"; exchanges: number; troopsLost: number; guardLeft: number };

export const readSiteCard = (
  store: NativeFactStore,
  site: NativeRows["ExpeditionSite"],
  structure: NativeRows["Structure"],
  siteTile: { col: number; row: number; alt: boolean },
  attack: SiteAttack | null,
): SiteCardPlan => {
  const guards = getGuardsByStructure(structure, store);
  const guard = guards && guards.find((candidate) => candidate.troops.count > 0n);
  const kind = siteKindOf(structure.base.category);
  const chest = kind === "Ruin" ? store.get("SiteChest", { game_id: site.game_id, entity_id: site.entity_id }) : null;
  const reward =
    kind === "Ruin"
      ? chest && { resourceType: ResourcesIds.Lords, amount: chest.amount * PRECISION }
      : siteReward(kind, site);
  return {
    name: siteName(store, kind, site, siteTile),
    guard: guards === undefined ? undefined : guard ? troopsOf(guard.troops) : null,
    kind,
    xp: siteClearXp(site),
    chest: chest && { tier: chest.tier, amount: Number(chest.amount) },
    payout: reward && fittingPayout(store, site.game_id, reward, attack),
    attackStamina: activeCombatRules().stamina.stamina_attack_req,
    fight: guard && attack ? forecastSiteFight(store, guard.troops, siteTile, attack) : undefined,
  };
};

/** The XP a clear pays, as the contract's clear_xp computes it from the guard the site started with. */
export const siteClearXp = (site: Pick<NativeRows["ExpeditionSite"], "initial_guard_count">): number =>
  Math.floor(Math.sqrt(25 * Number(site.initial_guard_count / PRECISION)) / 2);

/** A capped reward fits only the room left after the home's accrued production settles. */
const fittingPayout = (
  store: NativeFactStore,
  gameId: number,
  reward: { resourceType: ResourcesIds; amount: bigint },
  attack: SiteAttack | null,
): SiteCardPlan["payout"] => {
  const raw = Number(reward.amount) / Number(PRECISION);
  if (reward.resourceType !== ResourcesIds.Labor) return { resourceId: reward.resourceType, amount: raw, fits: raw };
  const actor = store.subscriptionScope().known?.actor;
  const home =
    attack?.army.owner ??
    (actor === undefined
      ? undefined
      : [...store.inGame("Structure", gameId)].find(
          (row) => row.owner === BigInt(actor) && row.base.category === StructureType.Realm,
        )?.entity_id);
  if (home === undefined) return undefined;
  const manager = new ResourceManager(store, home, gameId);
  const held = manager.balanceWithProduction(
    attack?.timestamp ?? getBlockTimestamp().currentDefaultTick,
    reward.resourceType,
  );
  if (!held) return undefined;
  const limit = manager.storeLimit(reward.resourceType);
  if (limit === undefined) return { resourceId: reward.resourceType, amount: raw, fits: raw };
  const fits = Math.min(raw, Math.max(0, (Number(limit) - held.balance) / Number(PRECISION)));
  return { resourceId: reward.resourceType, amount: raw, fits };
};

/** A site by its kind; a ruin by the Loot Survivor beast that holds it at its depth. */
const siteName = (
  store: NativeFactStore,
  kind: SiteKind,
  site: NativeRows["ExpeditionSite"],
  siteTile: { row: number },
): string => {
  if (kind !== "Ruin") return kind;
  const rules = readExpeditionRules(store, site.game_id);
  if (!rules) throw new Error(`Ruin ${site.entity_id} stands in a game without expedition rules`);
  return fallenRealmBeast(expeditionDepth(rules, { y: siteTile.row })).name;
};

const troopsOf = (troops: Pick<Troops, "category" | "tier" | "count">) => ({
  type: troops.category as TroopType,
  tier: troops.tier as TroopTier,
  count: Number(troops.count / PRECISION),
});

/**
 * The fight as the contract resolves it, attack after attack now, with no dice: Frontier's combat is exact. An army out
 * of its troops' reach has no fight to forecast.
 */
const forecastSiteFight = (
  store: NativeFactStore,
  guard: Troops,
  siteTile: { col: number; row: number; alt: boolean },
  attack: SiteAttack,
): SiteFight | undefined => {
  if (configManager.rollsCombatDice(siteTile.alt))
    throw new Error("Frontier's site forecast is exact; this game rolls dice");
  const troops = resolveExplorerTroops(store, attack.army);
  if (!troops) return undefined;
  const distance = getLayeredAttackDistance(attack.armyTile, siteTile);
  if (distance > getTroopAttackRange(troops.category)) return undefined;
  const forecast = forecastFight(
    troops,
    guard,
    {
      timestamp: attack.timestamp,
      currentTick: attack.armiesTick,
      attackDistance: distance,
      attackerBiome: attack.biome,
      defenderBiome: attack.biome,
      attackerIsStructureGuard: false,
      defenderIsStructureGuard: true,
      attackerRoll: 0,
      defenderRoll: 0,
    },
    activeCombatRules(),
  );
  if (forecast.outcome === "refused") return { outcome: "refused" };
  return {
    outcome: forecast.outcome,
    exchanges: forecast.exchanges,
    troopsLost: Number(forecast.attackerLoss / PRECISION),
    guardLeft: Number((guard.count - forecast.defenderLoss) / PRECISION),
  };
};
