import { catalogAspectId, orderAspect, type AspectId } from "@bibliothecadao/types";
import { nativeIdentifiers, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import {
  GOLDEN_DEVCON_HOLDERS,
  REGULAR_DEVCON_HOLDERS,
} from "../../../../contracts/l3/world-native/schema/devcon-holders.gen";
import type { NativeFactStore } from "../client/native-fact-store";

export const REALM_SKIN_FAMILIES = nativeIdentifiers.realmSkin;
export const REALM_SKIN_MODELS = ["RealmSkin", "Seal", "HomeAspect", "GameRegistry"] as const;

export const realmSkinEnabled = (commandMask: bigint): boolean =>
  (commandMask & BigInt(nativeCommandBits.SetRealmSkin)) !== 0n;

const {
  DEFAULT_REALM_SKIN,
  BASE_REALM_SKIN,
  SEASON_ONE_REALM_SKIN,
  WONDER_REALM_SKIN,
  DEVCON_REALM_SKIN,
  GOLDEN_DEVCON_REALM_SKIN,
} = REALM_SKIN_FAMILIES;

const GOLDEN_DEVCON_SET = new Set<bigint>(GOLDEN_DEVCON_HOLDERS.map((address) => BigInt(address)));
const REGULAR_DEVCON_SET = new Set<bigint>(REGULAR_DEVCON_HOLDERS.map((address) => BigInt(address)));

const parseOwnerAddress = (owner: bigint | string | null | undefined): bigint | null => {
  if (typeof owner === "bigint") return owner;
  if (typeof owner !== "string" || owner.trim() === "") return null;
  try {
    return BigInt(owner);
  } catch {
    return null;
  }
};

export const devconHoldingOf = (
  owner: bigint | string | null | undefined,
): { readonly devconHeld: boolean; readonly goldenDevconHeld: boolean } => {
  const parsed = parseOwnerAddress(owner);
  if (parsed === null) return { devconHeld: false, goldenDevconHeld: false };
  const goldenDevconHeld = GOLDEN_DEVCON_SET.has(parsed);
  const devconHeld = goldenDevconHeld || REGULAR_DEVCON_SET.has(parsed);
  return { devconHeld, goldenDevconHeld };
};

interface RealmSkinHolding {
  readonly sealHeld: boolean;
  readonly aspect: number | null;
  readonly hasWonder: boolean;
  readonly devconHeld?: boolean;
  readonly goldenDevconHeld?: boolean;
  readonly devUnlocked?: boolean;
}

export const holdsRealmSkin = (realm: RealmSkinHolding, family: number): boolean => {
  const devUnlocked = realm.devUnlocked === true;
  const hasAspect = realm.aspect !== null && realm.aspect !== 0;
  if (family === DEFAULT_REALM_SKIN || family === BASE_REALM_SKIN) return true;
  if (family === WONDER_REALM_SKIN) return realm.hasWonder || (devUnlocked && hasAspect);
  if (family === SEASON_ONE_REALM_SKIN) return (realm.sealHeld || devUnlocked) && hasAspect;
  if (family === DEVCON_REALM_SKIN) {
    return realm.devconHeld === true || realm.goldenDevconHeld === true || devUnlocked;
  }
  if (family === GOLDEN_DEVCON_REALM_SKIN) return realm.goldenDevconHeld === true || devUnlocked;
  return false;
};

export type DrawnRealmSkin =
  | typeof WONDER_REALM_SKIN
  | typeof SEASON_ONE_REALM_SKIN
  | typeof GOLDEN_DEVCON_REALM_SKIN
  | typeof DEVCON_REALM_SKIN
  | typeof BASE_REALM_SKIN;

export const DRAWN_REALM_SKINS: readonly DrawnRealmSkin[] = [
  WONDER_REALM_SKIN,
  SEASON_ONE_REALM_SKIN,
  GOLDEN_DEVCON_REALM_SKIN,
  DEVCON_REALM_SKIN,
  BASE_REALM_SKIN,
];

const isDrawnRealmSkin = (family: number): family is DrawnRealmSkin =>
  DRAWN_REALM_SKINS.some((drawn) => drawn === family);

export const wornRealmSkinFamily = (realm: RealmSkinHolding, equipped: number): DrawnRealmSkin => {
  if (isDrawnRealmSkin(equipped) && holdsRealmSkin(realm, equipped)) return equipped;
  const natural: RealmSkinHolding = { ...realm, devUnlocked: false };
  return DRAWN_REALM_SKINS.find((family) => holdsRealmSkin(natural, family)) ?? BASE_REALM_SKIN;
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

export const devCosmeticsUnlocked = (game: { readonly dev_mode_on?: boolean } | null | undefined): boolean =>
  game?.dev_mode_on === true;

export const realmWornSkinFamily = (
  store: Pick<NativeFactStore, "get">,
  realm: RealmSkinStructure,
  aspect?: number | null,
): DrawnRealmSkin => {
  const resolvedAspect = aspect !== undefined ? aspect : realmAspect(store, realm);
  const sealHeld = store.get("Seal", { game_id: realm.game_id, account: realm.owner }) !== undefined;
  const devcon = devconHoldingOf(realm.owner);
  const devUnlocked = devCosmeticsUnlocked(store.get("GameRegistry", { game_id: realm.game_id }));
  return wornRealmSkinFamily(
    { hasWonder: holdsWonder(realm), sealHeld, aspect: resolvedAspect, ...devcon, devUnlocked },
    equippedRealmSkin(store, realm),
  );
};

export const showsWonder = (realm: RealmSkinHolding, equipped: number = DEFAULT_REALM_SKIN): boolean =>
  wornRealmSkinFamily(realm, equipped) === WONDER_REALM_SKIN;

export const realmShowsWonder = (store: Pick<NativeFactStore, "get">, realm: RealmSkinStructure): boolean =>
  realmWornSkinFamily(store, realm) === WONDER_REALM_SKIN;
