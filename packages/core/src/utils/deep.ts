import { holdsOath, oathDeepLossPerTick } from "./oaths";
import { deepLossForArmy } from "./army-relics";
import { deepCenter, isDeepTile } from "./deep-geometry";
import { dayAtIndex } from "./days";
import { readExpeditionRules } from "./expeditions";
import { getBlockTimestamp } from "./timestamp";
import { nativeTilePackingConstants, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import {
  nativeOathConstants as oathRules,
  nativeRuleConstants,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { BiomeTypeToId, BiomeType, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";

export const DEEP_PAYOUT_MODELS = [
  "DeepRules",
  "DeepSite",
  "DeepTick",
  "GarrisonSlot",
  "Guard",
  "RaceResult",
  "GameRegistry",
  "SliceRules",
  "SettlementRules",
] as const;

export const deepAlliesGarrison = (kind: number): boolean =>
  kind === nativeRuleConstants.DEEP_FOUNDATION || kind === nativeRuleConstants.DEEP_ALTAR;

export function armiesBlockTile(
  store: Pick<NativeFactStore, "get">,
  game_id: number,
  tile: { col: number; row: number; alt: boolean },
): boolean {
  const settlement = store.get("SettlementRules", { game_id });
  return !(store.get("DeepRules", { game_id }) && settlement && isDeepTile(settlement.spacing, tile));
}

/** Fixed terrain is a view of the native Deep rules, without a reveal or a second tile store. */
export function deepTerrain(
  store: Pick<NativeFactStore, "get">,
  key: Pick<NativeRows["TileOpt"], "game_id" | "alt" | "col" | "row">,
): Pick<NativeRows["TileOpt"], "data"> | undefined {
  if (!store.get("DeepRules", { game_id: key.game_id })) return undefined;
  const settlement = store.get("SettlementRules", { game_id: key.game_id });
  if (!settlement) throw new Error("Deep terrain requires settlement rules");
  if (!isDeepTile(settlement.spacing, key)) return undefined;
  return { data: BigInt(BiomeTypeToId[BiomeType.Underground]) * BigInt(nativeTilePackingConstants.BIOME_SCALE) };
}

export function* deepTiles(
  store: Pick<NativeFactStore, "entries" | "get">,
): Generator<Pick<NativeRows["TileOpt"], "game_id" | "alt" | "col" | "row">> {
  for (const [, rules] of store.entries("DeepRules")) {
    const settlement = store.get("SettlementRules", { game_id: rules.game_id });
    if (!settlement) throw new Error("Deep terrain requires settlement rules");
    const center = deepCenter(settlement.spacing);
    const half = nativeRuleConstants.DEEP_MAP_SIZE / 2;
    for (let col = center.col - half; col < center.col + half; col++)
      for (let row = center.row - half; row < center.row + half; row++)
        yield { game_id: rules.game_id, alt: false, col, row };
  }
}

/** Derived count only: persisted troops and the last charged tick remain the sole native facts. */
export function currentArmy(
  store: Pick<NativeFactStore, "get">,
  army: NativeRows["ExplorerTroops"],
  timestamp?: number,
): NativeRows["ExplorerTroops"] {
  const key = { game_id: army.game_id, explorer_id: army.explorer_id };
  const deep = store.get("DeepArmy", key);
  if (!deep) return army;
  const rules = store.get("DeepRules", { game_id: army.game_id });
  const slice = store.get("SliceRules", { game_id: army.game_id });
  const birth = store.get("ArmyDay", key);
  const source = store.get("ExplorerTroops", key);
  if (!rules || !slice || !birth || !source) throw new Error("Deep attrition requires its rules and army facts");
  const calendar = readExpeditionRules(store, army.game_id);
  if (!calendar) throw new Error("Deep attrition requires expedition days");
  const end = dayAtIndex(calendar, Number(birth.day)).end;
  const interval = Number(slice.tick_config.armies_tick_in_seconds);
  if (interval <= 0 || rules.loss_per_tick <= 0n) throw new Error("Invalid Deep tick rules");
  const now = timestamp ?? getBlockTimestamp().currentDefaultTick;
  const tick = BigInt(Math.floor(Math.min(now, end) / interval));
  const elapsed = tick > deep.last_tick ? tick - deep.last_tick : 0n;
  const progress = store.get("ArmyProgress", key);
  if (!progress) throw new Error("Deep attrition requires its rules and army progress");
  const oathLoss = oathDeepLossPerTick(progress.oaths, rules.loss_per_tick);
  const active = store.get("ArmyRelicEffect", {
    game_id: key.game_id,
    explorer_id: key.explorer_id,
    kind: "Antidote",
  });
  const intervalBig = BigInt(interval);
  let loss: bigint;
  if (elapsed === 0n) {
    loss = 0n;
  } else if (active && active.rank > 0 && active.expires_at > deep.last_tick * intervalBig) {
    const expiryTick = active.expires_at / intervalBig;
    const protectedUntil = tick < expiryTick ? tick : expiryTick;
    const protectedTicks = protectedUntil > deep.last_tick ? protectedUntil - deep.last_tick : 0n;
    const unprotectedTicks = elapsed - protectedTicks;
    loss =
      protectedTicks * deepLossForArmy(progress.oaths, rules.loss_per_tick, active.rank) + unprotectedTicks * oathLoss;
  } else {
    loss = elapsed * oathLoss;
  }
  const count = loss >= source.troops.count ? 0n : source.troops.count - loss;
  return { ...source, troops: { ...source.troops, count } };
}

/** The same lost troops remove their carrying capacity when the native command settles them. */
export function currentResourceWeight(
  store: Pick<NativeFactStore, "get">,
  weight: NativeRows["ResourceWeight"],
  timestamp?: number,
): NativeRows["ResourceWeight"] {
  const key = { game_id: weight.game_id, explorer_id: weight.entity_id };
  if (!store.get("DeepArmy", key)) return weight;
  const source = store.get("ResourceWeight", { game_id: weight.game_id, entity_id: weight.entity_id });
  const army = store.get("ExplorerTroops", key);
  const rules = store.get("SliceRules", { game_id: weight.game_id });
  if (!source || !army || !rules) throw new Error("Deep capacity requires its army and rules");
  const loss =
    (army.troops.count - currentArmy(store, army, timestamp).troops.count) *
    BigInt(rules.capacity_config.troop_capacity);
  if (loss > source.capacity) throw new Error("Deep loss exceeds troop capacity");
  return { ...source, capacity: source.capacity - loss };
}

export interface DeepPoisonBreakdown {
  baseLossPerTick: bigint;
  vitriolActive: boolean;
  afterVitriolPerTick: bigint;
  antidoteRank: number;
  antidoteReductionPercent: number;
  antidoteExpiresAt: number;
  lossPerTick: bigint;
}

export function armyDeepPoisonBreakdown(
  store: Pick<NativeFactStore, "get">,
  key: Pick<NativeRows["ArmyProgress"], "game_id" | "explorer_id">,
  timestamp?: number,
): DeepPoisonBreakdown {
  const rules = store.get("DeepRules", { game_id: key.game_id });
  const progress = store.get("ArmyProgress", key);
  if (!rules || !progress) throw new Error("Deep attrition requires its rules and army progress");
  const baseLossPerTick = rules.loss_per_tick;
  const vitriolActive = holdsOath(progress.oaths, oathRules.VITRIOL);
  const afterVitriolPerTick = oathDeepLossPerTick(progress.oaths, baseLossPerTick);
  const now = Math.floor(timestamp ?? getBlockTimestamp().currentDefaultTick);
  const effect = store.get("ArmyRelicEffect", {
    game_id: key.game_id,
    explorer_id: key.explorer_id,
    kind: "Antidote",
  });
  const activeRank = effect && effect.rank > 0 && BigInt(now) < effect.expires_at ? effect.rank : 0;
  const antidoteReductionPercent = (activeRank * nativeRuleConstants.RELIC_ANTIDOTE_BPS) / 100;
  const lossPerTick = deepLossForArmy(progress.oaths, baseLossPerTick, activeRank);
  return {
    baseLossPerTick,
    vitriolActive,
    afterVitriolPerTick,
    antidoteRank: activeRank,
    antidoteReductionPercent,
    antidoteExpiresAt: activeRank > 0 ? Number(effect!.expires_at) : 0,
    lossPerTick,
  };
}

type DeepShare = { home: bigint; troops: bigint };

type DeepPayoutContext = {
  rules: NativeRows["DeepRules"];
  calendar: NonNullable<ReturnType<typeof readExpeditionRules>>;
  interval: bigint;
  cursor: bigint;
  last: bigint;
  endTick: bigint;
  active: boolean;
};

type ActiveDeepSite = {
  day: number;
  garrisons: readonly { slot: number; home: bigint; troops: { count: bigint } }[];
};

export function activeDeepSitePayPerMinute(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  site: ActiveDeepSite,
  home: bigint,
  amountPerTick: bigint,
  timestamp: number,
): bigint {
  if (amountPerTick <= 0n || site.garrisons.length === 0) return 0n;
  const rules = store.get("DeepRules", { game_id: gameId });
  if (!rules) return 0n;
  const context = readDeepPayoutContext(store, gameId, rules, timestamp);
  if (!context || !context.active) return 0n;
  const nextTick = BigInt(Math.floor(timestamp)) / context.interval + 1n;
  if (nextTick > context.endTick || nextTick > siteDayEndTick(context, BigInt(site.day))) return 0n;
  const sorted = [...site.garrisons]
    .sort((left, right) => left.slot - right.slot)
    .map(({ home: guardHome, troops }) => ({ home: guardHome, troops: troops.count }));
  const surviving = drainGarrisonStep(sorted, context.rules.loss_per_tick);
  if (!surviving.some((share) => share.home === home)) return 0n;
  const perTick = homeShareOfTick(amountPerTick, surviving, home);
  return (perTick * 60n) / context.interval;
}

export function projectedDeepResourcePayout(
  store: Pick<NativeFactStore, "get" | "inGame">,
  gameId: number,
  home: bigint,
  resourceId: ResourcesIds,
  timestamp: number,
): bigint | undefined {
  const siteKind = deepResourceSiteKind(resourceId);
  if (siteKind === undefined) return 0n;
  const rules = store.get("DeepRules", { game_id: gameId });
  if (!rules) return 0n;
  const slots = [...store.inGame("GarrisonSlot", gameId)];
  const heldSites = heldSitesForKind(store, gameId, home, siteKind, slots);
  if (heldSites === undefined) return undefined;
  if (heldSites.length === 0) return 0n;
  const context = readDeepPayoutContext(store, gameId, rules, timestamp);
  if (context === undefined) return undefined;
  if (context.last <= context.cursor) return 0n;
  const amountPerTick = siteKind === nativeRuleConstants.DEEP_CORE ? rules.core_per_tick : rules.mine_per_tick;
  let total = 0n;
  for (const site of heldSites) {
    const garrisons = readSiteGarrisons(store, gameId, site.entity_id, slots);
    if (garrisons === undefined) return undefined;
    total += projectSitePayout(site, garrisons, home, amountPerTick, context);
  }
  return total;
}

function deepResourceSiteKind(resourceId: ResourcesIds): number | undefined {
  if (resourceId === ResourcesIds.Essence) return nativeRuleConstants.DEEP_CORE;
  if (resourceId === ResourcesIds.Labor) return nativeRuleConstants.DEEP_MINE;
  return undefined;
}

function heldSitesForKind(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  home: bigint,
  siteKind: number,
  slots: readonly NativeRows["GarrisonSlot"][],
): NativeRows["DeepSite"][] | undefined {
  const seen = new Set<bigint>();
  const matched: NativeRows["DeepSite"][] = [];
  for (const slot of slots) {
    if (slot.home !== home || seen.has(slot.structure_id)) continue;
    seen.add(slot.structure_id);
    const site = store.get("DeepSite", { game_id: gameId, entity_id: slot.structure_id });
    if (!site) return undefined;
    if (site.kind === siteKind) matched.push(site);
  }
  return matched;
}

function readDeepPayoutContext(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  rules: NativeRows["DeepRules"],
  timestamp: number,
): DeepPayoutContext | undefined {
  const game = store.get("GameRegistry", { game_id: gameId });
  const slice = store.get("SliceRules", { game_id: gameId });
  const settlement = store.get("SettlementRules", { game_id: gameId });
  const deepTick = store.get("DeepTick", { game_id: gameId });
  if (!game || !slice || !settlement || !deepTick) return undefined;
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) return undefined;
  const interval = BigInt(slice.tick_config.armies_tick_in_seconds);
  if (interval <= 0n) throw new Error("Invalid Deep tick rules");
  const now = BigInt(Math.floor(timestamp));
  if (now < game.start_main_at) {
    return {
      rules,
      calendar,
      interval,
      cursor: deepTick.paid_tick,
      last: deepTick.paid_tick,
      endTick: game.end_at / interval,
      active: false,
    };
  }
  const raceResult = store.get("RaceResult", { game_id: gameId });
  const endAt = raceResult ? raceResult.ended_at : game.end_at;
  const capped = now < endAt ? now : endAt;
  return {
    rules,
    calendar,
    interval,
    cursor: deepTick.paid_tick,
    last: capped / interval,
    endTick: endAt / interval,
    active: !raceResult,
  };
}

function readSiteGarrisons(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  siteId: bigint,
  slots: readonly NativeRows["GarrisonSlot"][],
): DeepShare[] | undefined {
  const siteSlots = slots.filter((row) => row.structure_id === siteId).sort((left, right) => left.slot - right.slot);
  const garrisons: DeepShare[] = [];
  for (const { slot, home } of siteSlots) {
    if (slot < 0 || slot >= nativeRuleConstants.DEEP_GUARD_SLOTS) throw new Error("Invalid Deep garrison slot");
    const guard = store.get("Guard", { game_id: gameId, structure_id: siteId, slot });
    if (!guard) return undefined;
    if (guard.troops.count > 0n) garrisons.push({ home, troops: guard.troops.count });
  }
  return garrisons;
}

function siteDayEndTick(context: DeepPayoutContext, siteDay: bigint): bigint {
  return BigInt(dayAtIndex(context.calendar, Number(siteDay)).end) / context.interval;
}

function projectSitePayout(
  site: NativeRows["DeepSite"],
  garrisons: readonly DeepShare[],
  home: bigint,
  amountPerTick: bigint,
  context: DeepPayoutContext,
): bigint {
  if (garrisons.length === 0 || amountPerTick === 0n) return 0n;
  const dayEndTick = siteDayEndTick(context, site.day);
  const siteLast = context.last < dayEndTick ? context.last : dayEndTick;
  if (siteLast <= context.cursor) return 0n;
  const ticks = siteLast - context.cursor;
  const loss = context.rules.loss_per_tick;
  if (loss === 0n) {
    return homeShareOfTick(amountPerTick, garrisons, home) * ticks;
  }
  let maxTroops = 0n;
  let singleOwner = true;
  for (const garrison of garrisons) {
    if (garrison.troops > maxTroops) maxTroops = garrison.troops;
    if (garrison.home !== home) singleOwner = false;
  }
  const survivingTicks = (maxTroops - 1n) / loss;
  const payableTicks = ticks < survivingTicks ? ticks : survivingTicks;
  if (payableTicks <= 0n) return 0n;
  if (singleOwner) return payableTicks * amountPerTick;
  return sumSplitPayouts(garrisons, home, amountPerTick, loss, payableTicks);
}

function drainGarrisonStep(garrisons: readonly DeepShare[], loss: bigint): DeepShare[] {
  const alive: DeepShare[] = [];
  for (const garrison of garrisons) {
    const troops = garrison.troops > loss ? garrison.troops - loss : 0n;
    if (troops > 0n) alive.push({ home: garrison.home, troops });
  }
  return alive;
}

function sumSplitPayouts(
  garrisons: readonly DeepShare[],
  home: bigint,
  amountPerTick: bigint,
  loss: bigint,
  payableTicks: bigint,
): bigint {
  let alive: DeepShare[] = [...garrisons];
  let owed = 0n;
  for (let step = 0n; step < payableTicks; step++) {
    alive = drainGarrisonStep(alive, loss);
    if (alive.length === 0) break;
    owed += homeShareOfTick(amountPerTick, alive, home);
  }
  return owed;
}

function homeShareOfTick(amount: bigint, shares: readonly DeepShare[], home: bigint): bigint {
  const payments = splitDeepPayment(amount, shares);
  let total = 0n;
  for (let index = 0; index < shares.length; index++) {
    if (shares[index]!.home === home) total += payments[index]!;
  }
  return total;
}

function splitDeepPayment(amount: bigint, shares: readonly DeepShare[]): bigint[] {
  let total = 0n;
  for (const share of shares) total += share.troops;
  let allocated = 0n;
  const bases: bigint[] = [];
  const remainders: bigint[] = [];
  for (const share of shares) {
    const weighted = amount * share.troops;
    const base = weighted / total;
    allocated += base;
    bases.push(base);
    remainders.push(weighted % total);
  }
  const remaining = amount - allocated;
  return shares.map((share, index) => {
    const remainder = remainders[index]!;
    let ahead = 0n;
    for (let other = 0; other < shares.length; other++) {
      const otherRemainder = remainders[other]!;
      const otherHome = shares[other]!.home;
      const winsTie = otherHome < share.home || (otherHome === share.home && other < index);
      if (otherRemainder > remainder || (otherRemainder === remainder && winsTie)) ahead += 1n;
    }
    return bases[index]! + (ahead < remaining ? 1n : 0n);
  });
}
