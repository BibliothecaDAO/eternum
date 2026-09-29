import { fallenRealmBeast } from "@/three/structures/fallen-realm";
import {
  activeCombatRules,
  configManager,
  expeditionDepth,
  forecastFight,
  getGuardsByStructure,
  readExpeditionRules,
  siteReward,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import {
  type BiomeType,
  getLayeredAttackDistance,
  getTroopAttackRange,
  RESOURCE_PRECISION,
  type ResourcesIds,
  type Troops,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import { SITE_ART } from "./site-art";

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
 * What Frontier's tile card shows of a site (design §3.12, mockup 5), read from facts with no UI of its own: its art
 * and name, its guard as troops and tier (never strength), what clearing it pays, the attack's stamina, and the whole
 * fight from the army in reach as exact exchanges. The guard's count is unknown until its slots arrive; a fight only
 * exists for an army in reach.
 */
export interface SiteCardPlan {
  art: string;
  name: string;
  guard: { type: TroopType; tier: TroopTier; count: number } | null | undefined;
  /** Whole units paid home; null for a fallen realm, which pays its chest. */
  payout: { resourceId: ResourcesIds; amount: number } | null;
  attackStamina: number;
  fight: SiteFight | undefined;
}

type SiteFight =
  | { outcome: "refused" }
  | { outcome: "wins" | "loses" | "stalls"; exchanges: number; troopsLost: number };

export const readSiteCard = (
  store: NativeFactStore,
  site: NativeRows["ExpeditionSite"],
  structure: NativeRows["Structure"],
  siteTile: { col: number; row: number; alt: boolean },
  attack: SiteAttack | null,
): SiteCardPlan => {
  const guards = getGuardsByStructure(structure, store);
  const guard = guards && guards.find((candidate) => candidate.troops.count > 0n);
  const reward = siteReward(site);
  return {
    art: SITE_ART[site.kind],
    name: siteName(store, site, siteTile),
    guard: guards === undefined ? undefined : guard ? troopsOf(guard.troops) : null,
    payout: reward && { resourceId: reward.resourceType, amount: Number(reward.amount / PRECISION) },
    attackStamina: activeCombatRules().stamina.stamina_attack_req,
    fight: guard && attack ? forecastSiteFight(store, guard.troops, siteTile, attack) : undefined,
  };
};

/** A camp or rift by its kind; a fallen realm by the Loot Survivor beast that holds it at its depth. */
const siteName = (store: NativeFactStore, site: NativeRows["ExpeditionSite"], siteTile: { row: number }): string => {
  if (site.kind !== "FallenRealm") return site.kind;
  const rules = readExpeditionRules(store, site.game_id);
  if (!rules) throw new Error(`Fallen realm ${site.entity_id} stands in a game without expedition rules`);
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
  };
};
