import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { Tone } from "@/ui/design-system/kit/tone";
import { knownAmount } from "@/ui/utils/utils";
import { DEEP_PAYOUT_MODELS, type ExpeditionRules, getBalance, ResourceManager } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, type ResourcesIds } from "@bibliothecadao/types";

import { realmPerHour, secondsUntilHeld } from "./hud/army-order";
import { FRONTIER_STORES, STORE_KINDS, type StoreKind } from "./stores";

/** A store turns amber when it fills within the hour. */
const AMBER_SECONDS = 3_600;

/** One of the realm's stores as the strip and Production read it, in whole units; unknown is undefined. */
type RealmStore = {
  amount: number | undefined;
  /** The store's own limit (the contract's store_limit); none for Essence. */
  limit: number | undefined;
  perHour: number | undefined;
  /** Seconds until its next whole unit is in, counted from what has accrued since the last; none when it does not fill. */
  nextIn: number | undefined;
  /** Seconds until it is full at the current rate; 0 when full, none when it does not fill. */
  fullIn: number | undefined;
  tone: Tone;
};

/**
 * A store of the realm read once for every surface: what it holds, its limit, its rate an hour, when it is full, and
 * its tone (amber within the hour of full, ember at the limit).
 */
export const readRealmStore = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  kind: StoreKind,
  clock: { now: number },
): RealmStore => {
  const stock = FRONTIER_STORES[kind].resource;
  const realmId = safeInteger(realm.entity_id);
  const amount = wholeBalance(store, realmId, stock, clock.now, realm.game_id);
  const rawLimit = new ResourceManager(store, realmId, realm.game_id).storeLimit(stock);
  const limit = rawLimit === undefined ? undefined : Number(rawLimit / BigInt(RESOURCE_PRECISION));
  const perHour = realmPerHour(store, realmId, stock, clock.now);
  const fullIn = secondsUntilFull(amount, limit, perHour);
  const nextIn = secondsUntilNextUnit(store, realmId, stock, clock.now, perHour, realm.game_id);
  return { amount, limit, perHour, nextIn, fullIn, tone: storeTone(fullIn) };
};

const wholeBalance = (
  store: NativeFactStore,
  realmId: number,
  resourceId: ResourcesIds,
  tick: number,
  gameId: number,
) => {
  const balance = knownAmount(getBalance(realmId, resourceId, tick, store, gameId).balance);
  return balance === undefined ? undefined : Math.floor(balance);
};

/** What the stock holds with the part of a unit already made, until that part makes a whole one at the rate. */
const secondsUntilNextUnit = (
  store: NativeFactStore,
  realmId: number,
  resourceId: ResourcesIds,
  tick: number,
  perHour: number | undefined,
  gameId: number,
): number | undefined => {
  const held = knownAmount(getBalance(realmId, resourceId, tick, store, gameId).balance);
  return held === undefined ? undefined : secondsUntilHeld(held, Math.floor(held) + 1, perHour);
};

const secondsUntilFull = (
  amount: number | undefined,
  limit: number | undefined,
  perHour: number | undefined,
): number | undefined => {
  if (amount === undefined || limit === undefined) return undefined;
  if (amount >= limit) return 0;
  if (perHour === undefined || perHour <= 0) return undefined;
  return Math.ceil(((limit - amount) / perHour) * 3_600);
};

const storeTone = (fullIn: number | undefined): Tone =>
  fullIn === undefined ? "calm" : fullIn === 0 ? "ember" : fullIn <= AMBER_SECONDS ? "amber" : "calm";

const STORE_MODELS = [
  ...DEEP_PAYOUT_MODELS,
  "ResourceBalance",
  "ResourceProduction",
  "ResourceWeight",
  "BoardRules",
  "RealmKnowledge",
  "Structure",
  "ExplorerTroops",
  "ArmyProgress",
  "TileOccupancy",
] as const;

/** The realm's four stores, as the strip, the Realm dot and Production read them; none without a realm. */
export const useRealmStores = (
  realm: NativeRows["Structure"] | null,
  rules: ExpeditionRules,
): Record<StoreKind, RealmStore> | null => {
  const { setup } = useGame();
  const now = useCurrentDefaultTick();
  useNativeRevision(STORE_MODELS);
  if (!realm) return null;
  return Object.fromEntries(
    STORE_KINDS.map((kind) => [kind, readRealmStore(setup.store, realm, rules, kind, { now })]),
  ) as Record<StoreKind, RealmStore>;
};
