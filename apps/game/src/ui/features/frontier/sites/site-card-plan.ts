import { readStandingFrontierBeast, type FrontierBeast } from "@/three/structures/frontier-beast";
import {
  availableRuinLords,
  configManager,
  forecastFight,
  getBlockTimestamp,
  ResourceManager,
  getGuardsByStructure,
  siteKindOf,
  siteReward,
  siteClearXp,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
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

import { attackTargetName, type AttackTargetKind } from "./site-marks";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** An army about to attack a site, and the moment it would: everything the exchange depends on beyond the facts. */
export interface SiteAttack {
  army: NativeRows["ExplorerTroops"];
  armyTile: { col: number; row: number; alt: boolean };
  /** The site tile's biome, which both sides fight on. */
  biome: BiomeType;
  timestamp: number;
}

/**
 * What Frontier's tile card shows of a site (wireframe 06), read from facts with no UI of its own: its kind and name
 * (a ruin by its beast), its guard as troops and tier (never strength), what clearing it pays, the attack's stamina, and the whole
 * fight from the selected army as exact exchanges, wherever it stands. The guard's count is unknown until its slots
 * arrive.
 */
export interface SiteCardPlan {
  name: string;
  beast?: FrontierBeast;
  guard: { type: TroopType; tier: TroopTier; count: number } | null | undefined;
  kind: AttackTargetKind;
  /** The XP a clear pays; another player's army pays none this card can promise. */
  xp: number | undefined;
  /** A ruin's stored tier and whole LORDS; unknown until its chest fact arrives. */
  chest: { tier: number; amount: number; depth: string; funded: boolean } | null | undefined;
  /**
   * Whole units paid home and what fits beside what the store holds; null for XP-only sites, undefined until the home's
   * facts arrive.
   */
  payout: { resourceId: ResourcesIds; amount: number; fits: number } | null | undefined;
  attackStamina: number;
  /** Whether the selected army's troops reach the target from where they stand: Attack now, or Move first. */
  inReach: boolean;
  fight: SiteFight | undefined;
}

/**
 * The fight ahead, in two scales that never mix. The outcome and its count of attacks speak of the whole fight,
 * attack after attack. The troops lost and the guard left speak of the one attack the Attack button sends now, so they
 * are the figures its result will show.
 */
export type SiteFight =
  | { outcome: "refused" }
  | {
      outcome: "wins" | "loses" | "stalls";
      exchanges: number;
      troopsLost: number;
      guardLeft: number;
    };

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
      : siteReward(site);
  const beast = readStandingFrontierBeast(store, site.game_id, safeInteger(site.entity_id));
  return {
    name: beast?.name ?? attackTargetName(kind),
    beast,
    guard: guards === undefined ? undefined : guard ? troopsOf(guard.troops) : null,
    kind,
    xp: siteClearXp(site),
    chest: chest && {
      tier: chest.tier,
      amount: Number(chest.amount),
      depth: ["Surface", "Ethereal I", "Ethereal II", "Ethereal III"][
        Math.floor(site.row / store.require("SettlementRules", { game_id: site.game_id }).spacing) % 4
      ]!,
      funded:
        chest.amount > 0n &&
        availableRuinLords(store, site.game_id, attack?.timestamp ?? getBlockTimestamp().currentDefaultTick) >=
          chest.amount,
    },
    payout: reward && fittingPayout(store, site.game_id, reward, attack),
    attackStamina: configManager.getCombatRules().stamina.stamina_attack_req,
    inReach: attack !== null && reachOf(store, attack, siteTile) !== undefined,
    fight: guard && attack ? forecastFightAt(store, guard.troops, siteTile, attack, true) : undefined,
  };
};

/**
 * The same card for another player's army, where the game lets armies fight: its troops stand where a site's guard
 * does, the forecast is the same exact exchange without a guard's bonus, and it pays nothing the card can promise.
 */
export const readArmyCard = (
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  armyTile: { col: number; row: number; alt: boolean },
  attack: SiteAttack | null,
): SiteCardPlan => {
  const troops = resolveExplorerTroops(store, army);
  return {
    name: "Army",
    guard: troops === undefined ? undefined : troops.count > 0n ? troopsOf(troops) : null,
    kind: "Army",
    xp: undefined,
    chest: null,
    payout: null,
    attackStamina: configManager.getCombatRules().stamina.stamina_attack_req,
    inReach: attack !== null && reachOf(store, attack, armyTile) !== undefined,
    fight: troops && troops.count > 0n && attack ? forecastFightAt(store, troops, armyTile, attack, false) : undefined,
  };
};

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
  const manager = new ResourceManager(store, safeInteger(home), gameId);
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

const troopsOf = (troops: Pick<Troops, "category" | "tier" | "count">) => ({
  type: troops.category as TroopType,
  tier: troops.tier as TroopTier,
  count: Number(troops.count / PRECISION),
});

/** The distance the army's troops strike the target from where they stand; undefined out of their reach. */
const reachOf = (
  store: NativeFactStore,
  attack: SiteAttack,
  target: { col: number; row: number; alt: boolean },
): number | undefined => {
  const troops = resolveExplorerTroops(store, attack.army);
  if (!troops) return undefined;
  const distance = getLayeredAttackDistance(attack.armyTile, target);
  return distance <= getTroopAttackRange(troops.category) ? distance : undefined;
};

/** Where an army out of reach attacks from: the tile beside the target, where its Move leads. */
const BESIDE = 1;

/**
 * The fight as the contract resolves it, attack after attack from the moment the army can attack, with no dice:
 * Frontier's combat is exact. An army out of reach is forecast from beside the target, with the stamina it holds now:
 * how far it stands decides only whether Attack can be sent yet (owner, 31 October 2026: "I should still have the
 * projection even if I'm too far I think").
 */
const forecastFightAt = (
  store: NativeFactStore,
  guard: Troops,
  siteTile: { col: number; row: number; alt: boolean },
  attack: SiteAttack,
  defenderIsStructureGuard: boolean,
): SiteFight | undefined => {
  if (configManager.rollsCombatDice(siteTile.alt))
    throw new Error("Frontier's site forecast is exact; this game rolls dice");
  const troops = resolveExplorerTroops(store, attack.army);
  if (!troops) return undefined;
  const distance = reachOf(store, attack, siteTile) ?? BESIDE;
  const forecast = forecastFight(
    troops,
    guard,
    {
      timestamp: whenItCanAttack(troops, attack.timestamp),
      attackDistance: distance,
      attackerBiome: attack.biome,
      defenderBiome: attack.biome,
      attackerIsStructureGuard: false,
      defenderIsStructureGuard,
      attackerRoll: 0,
      defenderRoll: 0,
    },
    configManager.getCombatRules(),
  );
  if (forecast.outcome === "refused") return { outcome: "refused" };
  return {
    outcome: forecast.outcome,
    exchanges: forecast.exchanges,
    troopsLost: Number(forecast.firstExchange.attackerLoss / PRECISION),
    guardLeft: Number((guard.count - forecast.firstExchange.defenderLoss) / PRECISION),
  };
};

/**
 * The moment the army holds the attack's stamina: now, or later for an army short of it, so the card counts the fight
 * its Attack will send rather than none. Damage does not depend on the attacker's stamina; the guard's own stamina at
 * that moment does, and is read then.
 */
const whenItCanAttack = (troops: Troops, now: number): number =>
  StaminaManager.getAffordableAt(troops, configManager.getCombatRules().stamina.stamina_attack_req, now) ?? now;
