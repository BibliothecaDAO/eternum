import { catalogAspectId, orderAspect, type AspectId } from "@bibliothecadao/types";
import { nativeIdentifiers, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import type { NativeFactStore } from "../client/native-fact-store";

export const REALM_SKIN_FAMILIES = nativeIdentifiers.realmSkin;
export const REALM_SKIN_MODELS = ["RealmSkin", "Seal", "HomeAspect"] as const;

export const realmSkinEnabled = (commandMask: bigint): boolean =>
  (commandMask & BigInt(nativeCommandBits.SetRealmSkin)) !== 0n;

const { DEFAULT_REALM_SKIN, BASE_REALM_SKIN, SEASON_ONE_REALM_SKIN, WONDER_REALM_SKIN } = REALM_SKIN_FAMILIES;

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

type DrawnRealmSkin = typeof WONDER_REALM_SKIN | typeof SEASON_ONE_REALM_SKIN | typeof BASE_REALM_SKIN;

export const DRAWN_REALM_SKINS: readonly DrawnRealmSkin[] = [WONDER_REALM_SKIN, SEASON_ONE_REALM_SKIN, BASE_REALM_SKIN];

const isDrawnRealmSkin = (family: number): family is DrawnRealmSkin =>
  DRAWN_REALM_SKINS.some((drawn) => drawn === family);

export const wornRealmSkinFamily = (realm: RealmSkinHolding, equipped: number): DrawnRealmSkin => {
  if (isDrawnRealmSkin(equipped) && holdsRealmSkin(realm, equipped)) return equipped;
  return DRAWN_REALM_SKINS.find((family) => holdsRealmSkin(realm, family)) ?? BASE_REALM_SKIN;
};

export const equippedRealmSkin = (
  store: Pick<NativeFactStore, "get">,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id">,
): number =>
  store.get("RealmSkin", { game_id: realm.game_id, entity_id: realm.entity_id })?.family ?? DEFAULT_REALM_SKIN;

type RealmSkinStructure = Pick<NativeRows["Structure"], "game_id" | "entity_id" | "owner"> & {
  readonly metadata: Pick<NativeRows["Structure"]["metadata"], "has_wonder" | "order">;
};

export const holdsWonder = (realm: Pick<RealmSkinStructure, "metadata">): boolean => realm.metadata.has_wonder;

export const realmOrderAspect = (order: number | undefined, homeAspect?: AspectId | null): AspectId | null => {
  if (homeAspect != null) return homeAspect;
  return order ? (orderAspect(order) ?? null) : null;
};

export const realmAspect = (
  store: Pick<NativeFactStore, "get">,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id"> & {
    readonly metadata: Pick<NativeRows["Structure"]["metadata"], "order">;
  },
): AspectId | null => {
  const homeAspect = store.get("HomeAspect", { game_id: realm.game_id, home: realm.entity_id })?.aspect;
  return realmOrderAspect(
    realm.metadata.order,
    homeAspect !== undefined && homeAspect !== 0 ? catalogAspectId(homeAspect) : null,
  );
};

export const realmWornSkinFamily = (
  store: Pick<NativeFactStore, "get">,
  realm: RealmSkinStructure,
  aspect?: number | null,
): DrawnRealmSkin => {
  const resolvedAspect = aspect !== undefined ? aspect : realmAspect(store, realm);
  const sealHeld = store.get("Seal", { game_id: realm.game_id, account: realm.owner }) !== undefined;
  return wornRealmSkinFamily(
    { hasWonder: holdsWonder(realm), sealHeld, aspect: resolvedAspect },
    equippedRealmSkin(store, realm),
  );
};

export const showsWonder = (realm: RealmSkinHolding, equipped: number = DEFAULT_REALM_SKIN): boolean =>
  wornRealmSkinFamily(realm, equipped) === WONDER_REALM_SKIN;

export const realmShowsWonder = (store: Pick<NativeFactStore, "get">, realm: RealmSkinStructure): boolean =>
  realmWornSkinFamily(store, realm) === WONDER_REALM_SKIN;
