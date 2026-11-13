import { readStandingFrontierBeast, type FrontierBeast } from "@/three/structures/frontier-beast";
import {
  availableRuinLords,
  configManager,
  getBlockTimestamp,
  ResourceManager,
  resolveExchange,
  getGuardsByStructure,
  siteKindOf,
  siteReward,
  siteClearXp,
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

import { siteDepthName } from "@/ui/design-system/kit/words";

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
 * (a ruin by its beast), its guard as troops and tier (never strength), what clearing it pays, the attack's stamina, and the
 * attack the selected army would send now, wherever it stands. The guard's count is unknown until its slots arrive.
 */
export interface SiteCardPlan {
  name: string;
  beast?: FrontierBeast;
  guard: { type: TroopType; tier: TroopTier; count: number } | null | undefined;
  kind: AttackTargetKind;
  /** The XP a clear pays; another player's army pays none this card can promise. */
  xp: number | undefined;
  /** A ruin's stored tier and whole LORDS; unknown until its chest fact arrives. */
  ruinDepth?: string;
  chest: { tier: number; amount: number; funded: boolean } | null | undefined;
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
 * The one attack the Attack button sends, as the contract resolves it now: what it costs the army and leaves the guard,
 * the figures its result will show; or refused, as the contract refuses it now (an army short of the attack's stamina),
 * where the card says why instead. Nothing on the card speaks of later attacks.
 */
export type SiteFight = { refused: true } | { troopsLost: number; guardLeft: number };

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
      : siteReward(store, site);
  const beast = readStandingFrontierBeast(store, site.game_id, safeInteger(site.entity_id));
  return {
    name: beast?.name ?? attackTargetName(kind),
    beast,
    guard: guards === undefined ? undefined : guard ? troopsOf(guard.troops) : null,
    kind,
    xp: siteClearXp(store, site),
    ruinDepth:
      kind === "Ruin"
        ? siteDepthName(Math.floor(site.row / store.require("SettlementRules", { game_id: site.game_id }).spacing) % 4)
        : undefined,
    chest: chest && {
      tier: chest.tier,
      amount: Number(chest.amount),
      funded:
        chest.amount > 0n &&
        availableRuinLords(store, site.game_id, attack?.timestamp ?? getBlockTimestamp().currentDefaultTick) >=
          chest.amount,
    },
    payout: reward && fittingPayout(store, site.game_id, reward, attack),
    attackStamina: configManager.getCombatRules().stamina.stamina_attack_req,
    inReach: attack !== null && reachOf(store, attack, siteTile) !== undefined,
    fight: guard && attack ? attackNow(store, guard.troops, siteTile, attack, true) : undefined,
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
    fight: troops && troops.count > 0n && attack ? attackNow(store, troops, armyTile, attack, false) : undefined,
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
 * The attack as the contract would resolve it at the army's clock, with no dice: Frontier's combat is exact. An army
 * out of reach is read from beside the target, with the stamina it holds now: how far it stands decides only whether
 * Attack can be sent yet (owner, 31 October 2026: "I should still have the projection even if I'm too far I think").
 * Both sides' stamina are this moment's, so the guard's (a tired guard strikes at 70%) is the one Attack meets.
 */
const attackNow = (
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
  const exchange = resolveExchange(
    troops,
    guard,
    {
      timestamp: attack.timestamp,
      attackDistance: reachOf(store, attack, siteTile) ?? BESIDE,
      attackerBiome: attack.biome,
      defenderBiome: attack.biome,
      attackerIsStructureGuard: false,
      defenderIsStructureGuard,
      attackerRoll: 0,
      defenderRoll: 0,
    },
    configManager.getCombatRules(),
  );
  if (!exchange.ok) return { refused: true };
  return {
    troopsLost: Number(exchange.attackerLoss / PRECISION),
    guardLeft: Number((guard.count - exchange.defenderLoss) / PRECISION),
  };
};
