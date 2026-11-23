import { canonicalRealm, getStructureName } from "@bibliothecadao/eternum";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { orderAspect } from "@bibliothecadao/types";

import { orderEmblem } from "@/ui/design-system/kit/order-emblem";

import type { DoorwayRealm } from "./doorway-screen";

export const doorwayRealmOf = (structure: NativeRows["Structure"], store: NativeFactStore): DoorwayRealm | null => {
  if (!isRealmCategory(structure.base.category)) return null;
  const order = Number(structure.metadata.order);
  return {
    name: getStructureName(structure, store).name,
    emblem: order === 0 ? null : orderEmblem(order),
    aspect: order === 0 ? null : orderAspect(order),
  };
};

export const toPaddedFeltAddress = (address: string | null | undefined): string | null => {
  if (!address) return null;
  try {
    return `0x${BigInt(address).toString(16).padStart(64, "0")}`;
  } catch {
    return null;
  }
};

export const doorwayRealmFromId = (realmId: number): DoorwayRealm | null => {
  const realm = canonicalRealm(realmId);
  if (!realm) return null;
  return {
    name: realm.name,
    emblem: realm.order === 0 ? null : orderEmblem(realm.order),
    aspect: realm.order === 0 ? null : orderAspect(realm.order),
  };
};
