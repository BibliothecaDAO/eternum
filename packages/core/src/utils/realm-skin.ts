import { orderAspect } from "@bibliothecadao/types";
import { nativeIdentifiers, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import type { NativeFactStore } from "../client/native-fact-store";

export const REALM_SKIN_FAMILIES = nativeIdentifiers.realmSkin;

export const realmSkinEnabled = (commandMask: bigint): boolean =>
  (commandMask & BigInt(nativeCommandBits.SetRealmSkin)) !== 0n;

const { DEFAULT_REALM_SKIN, BASE_REALM_SKIN, SEASON_ONE_REALM_SKIN, WONDER_REALM_SKIN } = REALM_SKIN_FAMILIES;

export const SEASON_ONE_DRAWN_LEVELS = [0, 1] as const;

interface RealmSkinHolding {
  readonly sealHeld: boolean;
  readonly aspect: number | null;
  readonly hasWonder: boolean;
}

export const holdsRealmSkin = (realm: RealmSkinHolding, family: number): boolean => {
  if (family === DEFAULT_REALM_SKIN || family === BASE_REALM_SKIN) return true;
  if (family === WONDER_REALM_SKIN) return realm.hasWonder;
  return family === SEASON_ONE_REALM_SKIN && realm.sealHeld && realm.aspect !== null && realm.aspect !== 0;
};

type AlwaysDrawnRealmSkin = typeof WONDER_REALM_SKIN | typeof BASE_REALM_SKIN;
type DrawnRealmSkin = AlwaysDrawnRealmSkin | typeof SEASON_ONE_REALM_SKIN;

export const DRAWN_REALM_SKINS: readonly AlwaysDrawnRealmSkin[] = [WONDER_REALM_SKIN, BASE_REALM_SKIN];

export const hasSeasonOneRealmSkinAt = (level: number | null | undefined): boolean =>
  level != null && SEASON_ONE_DRAWN_LEVELS.some((drawn) => drawn === level);

export const isDrawnRealmSkin = (family: number, level?: number | null): family is DrawnRealmSkin =>
  family === WONDER_REALM_SKIN ||
  family === BASE_REALM_SKIN ||
  (family === SEASON_ONE_REALM_SKIN && hasSeasonOneRealmSkinAt(level));

const drawnRealmSkinOrder = (level?: number | null): readonly DrawnRealmSkin[] =>
  hasSeasonOneRealmSkinAt(level) ? [WONDER_REALM_SKIN, SEASON_ONE_REALM_SKIN, BASE_REALM_SKIN] : DRAWN_REALM_SKINS;

export const wornRealmSkinFamily = (
  realm: RealmSkinHolding,
  equipped: number,
  level?: number | null,
): DrawnRealmSkin => {
  if (isDrawnRealmSkin(equipped, level) && holdsRealmSkin(realm, equipped)) return equipped;
  return drawnRealmSkinOrder(level).find((family) => holdsRealmSkin(realm, family)) ?? BASE_REALM_SKIN;
};

export const equippedRealmSkin = (
  store: Pick<NativeFactStore, "get">,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id">,
): number =>
  store.get("RealmSkin", { game_id: realm.game_id, entity_id: realm.entity_id })?.family ?? DEFAULT_REALM_SKIN;

type RealmSkinStructure = Pick<NativeRows["Structure"], "game_id" | "entity_id" | "owner"> & {
  readonly base: Pick<NativeRows["Structure"]["base"], "level">;
  readonly metadata: Pick<NativeRows["Structure"]["metadata"], "has_wonder" | "order">;
};

export const holdsWonder = (realm: Pick<RealmSkinStructure, "metadata">): boolean => realm.metadata.has_wonder;

export const realmWornSkinFamily = (
  store: Pick<NativeFactStore, "get">,
  realm: RealmSkinStructure,
  aspect?: number | null,
  level?: number | null,
): DrawnRealmSkin => {
  const resolvedAspect =
    aspect !== undefined ? aspect : realm.metadata.order ? orderAspect(realm.metadata.order) : null;
  const resolvedLevel = level !== undefined ? level : realm.base.level;
  const sealHeld = store.get("Seal", { game_id: realm.game_id, account: realm.owner }) !== undefined;
  return wornRealmSkinFamily(
    { hasWonder: holdsWonder(realm), sealHeld, aspect: resolvedAspect },
    equippedRealmSkin(store, realm),
    resolvedLevel,
  );
};

export const showsWonder = (
  realm: RealmSkinHolding,
  equipped: number = DEFAULT_REALM_SKIN,
  level?: number | null,
): boolean => wornRealmSkinFamily(realm, equipped, level) === WONDER_REALM_SKIN;

export const realmShowsWonder = (store: Pick<NativeFactStore, "get">, realm: RealmSkinStructure): boolean =>
  realmWornSkinFamily(store, realm) === WONDER_REALM_SKIN;
