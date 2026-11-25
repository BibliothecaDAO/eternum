import { readStandingFrontierBeast, type FrontierBeast } from "@/three/structures/frontier-beast";
import {
  armyOaths,
  armyRelicReward,
  configManager,
  forecastAttack,
  getBlockTimestamp,
  ResourceManager,
  hasCastleLimit,
  getDefendingGuards,
  oathAttackStamina,
  isCleanWin,
  isSupplyPost,
  oathSitePay,
  siteHoldsOath,
  siteKindOf,
  type AttackForecast,
  type AttackRefusal,
} from "@bibliothecadao/eternum";
import {
  readSiteReward,
  safeInteger,
  type DeepSiteView,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { resolveExplorerCombatTroops } from "@bibliothecadao/eternum/troop-stamina";
import {
  layerName,
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

  ruinDepth?: string;

  payout: { resourceId: ResourcesIds; amount: number; fits: number } | null | undefined;
  attackStamina: number;
  /** Whether the selected army's troops reach the target from where they stand: Attack now, or Move first. */
  inReach: boolean;
  fight: SiteFight | undefined;
  blocked: AttackRefusal | undefined;
  holdsOath: boolean;
  /** Whether this army's clear would make the site a supply post its armies refill beside today. */
  opensPost: boolean;
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
  attack: SiteAttack | null,
): SiteCardPlan => {
  const guards = getDefendingGuards(structure, store, attack?.timestamp);
  const guard = guards?.[0];
  const kind = siteKindOf(structure.base.category);
  const baseReward = kind === "Ruin" ? null : readSiteReward(store, site, attack?.timestamp).known?.reward;
  const planned = attack ? forecastFrom(store, attack, structure.entity_id) : undefined;
  const clean = clearsCleanly(planned?.forecast, guards?.length ?? 0);
  const reward = baseReward && attack ? attackerReward(store, attack, baseReward, clean) : baseReward;
  const beast = readStandingFrontierBeast(store, site.game_id, safeInteger(site.entity_id));
  return {
    name: beast?.name ?? attackTargetName(kind),
    beast,
    guard: guards === undefined ? undefined : guard ? troopsOf(guard.troops) : null,
    kind,
    ruinDepth:
      kind === "Ruin"
        ? layerName(Math.floor(site.row / store.require("SettlementRules", { game_id: site.game_id }).spacing) % 4)
        : undefined,
    payout: reward && fittingPayout(store, site.game_id, reward, attack),
    holdsOath: siteHoldsOath(store, site),
    opensPost: attack !== null && clearOpensPost(store, site, attack),
    attackStamina: attackStaminaOf(store, attack),
    ...planAttack(planned),
  };
};

/** The supply post rule asked of the site as this army's clear would leave it. */
const clearOpensPost = (store: NativeFactStore, site: NativeRows["ExpeditionSite"], { army, timestamp }: SiteAttack) =>
  isSupplyPost(
    store,
    { ...site, clear: { explorer_id: army.explorer_id, home_id: army.owner, reward: null } },
    army.owner,
    timestamp,
  );

const attackStaminaOf = (store: NativeFactStore, attack: SiteAttack | null): number => {
  const base = configManager.getCombatRules().stamina.stamina_attack_req;
  return attack ? oathAttackStamina(armyOaths(store, attack.army), base) : base;
};

const attackerReward = (
  store: NativeFactStore,
  attack: SiteAttack,
  reward: { resourceType: ResourcesIds; amount: bigint },
  clean: boolean,
) => {
  const paid = { ...reward, amount: oathSitePay(armyOaths(store, attack.army), reward.amount, clean) };
  return armyRelicReward(store, attack.army, paid, attack.timestamp);
};

/**
 * The same card for another player's army, where the game lets armies fight: its troops stand where a site's guard
 * does, the forecast is the same exact exchange without a guard's bonus, and it pays nothing the card can promise.
 */
export const readArmyCard = (
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  attack: SiteAttack | null,
): SiteCardPlan => {
  const troops = resolveExplorerCombatTroops(store, army, attack?.timestamp ?? getBlockTimestamp().currentDefaultTick);
  return {
    name: "Army",
    guard: troops === undefined ? undefined : troops.count > 0n ? troopsOf(troops) : null,
    kind: "Army",
    payout: null,
    holdsOath: false,
    opensPost: false,
    attackStamina: attackStaminaOf(store, attack),
    ...planAttack(attack ? forecastFrom(store, attack, army.explorer_id) : undefined),
  };
};

export interface DeepSiteFight {
  army: number;
  defender: number;
  attackerTroops: Pick<Troops, "category" | "tier">;
  defenderTroops: Pick<Troops, "category" | "tier">;
  result: SiteFight | undefined;
}

/** One Deep attack faces the highest living guard army, or the site's beast. */
export function readDeepSiteFight(
  store: NativeFactStore,
  site: DeepSiteView,
  attack: SiteAttack,
): DeepSiteFight | undefined {
  const { forecast } = forecastFrom(store, attack, site.id);
  if (!forecast) return undefined;
  const sides = forecast.sides;
  if (!sides?.defender) return undefined;
  return {
    army: Number(sides.attacker.troops.count / PRECISION),
    defender: Number(sides.defender.troops.count / PRECISION),
    attackerTroops: { category: sides.attacker.troops.category, tier: sides.attacker.troops.tier },
    defenderTroops: { category: sides.defender.troops.category, tier: sides.defender.troops.tier },
    result: siteFight(forecast),
  };
}

/** A capped reward fits only the room left after the home's accrued production settles. */
const fittingPayout = (
  store: NativeFactStore,
  gameId: number,
  reward: { resourceType: ResourcesIds; amount: bigint },
  attack: SiteAttack | null,
): SiteCardPlan["payout"] => {
  const raw = Number(reward.amount) / Number(PRECISION);
  if (!hasCastleLimit(reward.resourceType)) return { resourceId: reward.resourceType, amount: raw, fits: raw };
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

const planAttack = (
  planned: ReturnType<typeof forecastFrom> | undefined,
): Pick<SiteCardPlan, "inReach" | "fight" | "blocked"> => {
  if (!planned) return { inReach: false, fight: undefined, blocked: undefined };
  const { inReach, forecast } = planned;
  const refusal = forecast?.outcome === "refused" ? forecast.refusal : undefined;
  return {
    inReach,
    fight: siteFight(forecast),
    blocked: refusal === undefined || refusal === "insufficient-stamina" ? undefined : refusal,
  };
};

const forecastFrom = (store: NativeFactStore, attack: SiteAttack, targetId: bigint) => {
  const key = (entity_id: bigint) => ({ game_id: attack.army.game_id, entity_id });
  const forecastAt = (besideTarget: boolean) =>
    forecastAttack(store, key(attack.army.explorer_id), key(targetId), attack.timestamp, { besideTarget });
  const now = forecastAt(false);
  const inReach = !(now?.outcome === "refused" && now.refusal === "out-of-range");
  return { inReach, forecast: inReach ? now : forecastAt(true) };
};

const clearsCleanly = (forecast: AttackForecast | undefined, guardsLeft: number): boolean =>
  forecast?.outcome === "fights" &&
  guardsLeft <= 1 &&
  forecast.exchange.defender.count === 0n &&
  isCleanWin(forecast.exchange.attacker.count + forecast.exchange.attackerLoss, forecast.exchange.attacker.count);

const siteFight = (forecast: AttackForecast | undefined): SiteFight | undefined => {
  if (forecast?.outcome === "fights") {
    return {
      troopsLost: Number(forecast.exchange.attackerLoss / PRECISION),
      guardLeft: Number(forecast.exchange.defender.count / PRECISION),
    };
  }
  return forecast?.outcome === "refused" && forecast.sides?.defender ? { refused: true } : undefined;
};
