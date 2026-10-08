import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { Tone } from "@/ui/design-system/kit/tone";
import { knownBalance } from "@/ui/utils/utils";
import { type ExpeditionRules, getBalance, getTroopResourceId, ResourceManager } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";

import { troopsAtHome } from "./frontier-home";
import { realmPerHour } from "./hud/army-order";

/** A store turns amber when it fills within the hour. */
const AMBER_SECONDS = 3_600;

/** The one troop type's stock: the barracks train it, and its limit is every troop stock's. */
const TROOP_STOCK = getTroopResourceId(TroopType.Knight, TroopTier.T1);

/** One of the realm's stores as the strip and Production read it, in whole units; unknown is undefined. */
type RealmStore = {
  amount: number | undefined;
  /** The store's own limit (the contract's store_limit); none for Essence. */
  limit: number | undefined;
  perHour: number | undefined;
  /** Seconds until it is full at the current rate; 0 when full, none when it does not fill. */
  fullIn: number | undefined;
  tone: Tone;
};

/**
 * A store of the realm read once for every surface: what it holds, its limit, its rate an hour, when it is full, and
 * its tone (amber within the hour of full, ember at the limit). Troops count what the next deploy finds, with
 * Homecoming's return.
 */
export const readRealmStore = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  rules: ExpeditionRules,
  resourceId: ResourcesIds | "troops",
  clock: { now: number; tick: number },
): RealmStore => {
  const stock = resourceId === "troops" ? TROOP_STOCK : resourceId;
  const amount =
    resourceId === "troops"
      ? troopsAtHome(store, realm, rules, clock.now, clock.tick)
      : wholeBalance(store, realm.entity_id, resourceId, clock.tick);
  const rawLimit = new ResourceManager(store, realm.entity_id, realm.game_id).storeLimit(stock);
  const limit = rawLimit === undefined ? undefined : Number(rawLimit / BigInt(RESOURCE_PRECISION));
  const perHour = realmPerHour(store, realm.entity_id, stock, clock.tick);
  const fullIn = secondsUntilFull(amount, limit, perHour);
  return { amount, limit, perHour, fullIn, tone: storeTone(fullIn) };
};

const wholeBalance = (store: NativeFactStore, realmId: number, resourceId: ResourcesIds, tick: number) => {
  const balance = knownBalance(getBalance(realmId, resourceId, tick, store).balance);
  return balance === undefined ? undefined : Math.floor(balance);
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

/** The Realm slot's dot: the worst tone among the stores the realm board spends (wheat, labor, troops). */
export const realmDot = (stores: readonly Pick<RealmStore, "tone">[]): "amber" | "ember" | undefined =>
  stores.some(({ tone }) => tone === "ember")
    ? "ember"
    : stores.some(({ tone }) => tone === "amber")
      ? "amber"
      : undefined;

const STORE_MODELS = [
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
): Record<"essence" | "labor" | "wheat" | "troops", RealmStore> | null => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const now = useNowSeconds();
  useNativeRevision(STORE_MODELS);
  if (!realm) return null;
  const read = (resourceId: ResourcesIds | "troops") =>
    readRealmStore(setup.store, realm, rules, resourceId, { now, tick });
  return {
    essence: read(ResourcesIds.Essence),
    labor: read(ResourcesIds.Labor),
    wheat: read(ResourcesIds.Wheat),
    troops: read("troops"),
  };
};
