import { nativeIdentifiers, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import type { NativeFactStore } from "../client/native-fact-store";

export const REALM_SKIN_FAMILIES = nativeIdentifiers.realmSkin;

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

type DrawnRealmSkin = typeof WONDER_REALM_SKIN | typeof BASE_REALM_SKIN;

export const DRAWN_REALM_SKINS: readonly DrawnRealmSkin[] = [WONDER_REALM_SKIN, BASE_REALM_SKIN];

export const isDrawnRealmSkin = (family: number): family is DrawnRealmSkin =>
  DRAWN_REALM_SKINS.some((drawn) => drawn === family);

const holdsDrawnRealmSkin = (realm: Pick<RealmSkinHolding, "hasWonder">, family: DrawnRealmSkin) =>
  holdsRealmSkin({ ...realm, sealHeld: false, aspect: null }, family);

export const wornRealmSkinFamily = (realm: Pick<RealmSkinHolding, "hasWonder">, equipped: number): DrawnRealmSkin => {
  if (isDrawnRealmSkin(equipped) && holdsDrawnRealmSkin(realm, equipped)) return equipped;
  return DRAWN_REALM_SKINS.find((family) => holdsDrawnRealmSkin(realm, family)) ?? BASE_REALM_SKIN;
};

export const equippedRealmSkin = (
  store: Pick<NativeFactStore, "get">,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id">,
): number =>
  store.get("RealmSkin", { game_id: realm.game_id, entity_id: realm.entity_id })?.family ?? DEFAULT_REALM_SKIN;

export const holdsWonder = (realm: Pick<NativeRows["Structure"], "metadata">): boolean => realm.metadata.has_wonder;

export const showsWonder = (hasWonder: boolean, equipped: number = DEFAULT_REALM_SKIN): boolean =>
  wornRealmSkinFamily({ hasWonder }, equipped) === WONDER_REALM_SKIN;

export const realmShowsWonder = (
  store: Pick<NativeFactStore, "get">,
  realm: Pick<NativeRows["Structure"], "game_id" | "entity_id" | "metadata">,
): boolean => showsWonder(holdsWonder(realm), equippedRealmSkin(store, realm));
