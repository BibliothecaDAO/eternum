import { getStructureName } from "@bibliothecadao/eternum";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import type { NativeRows, NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { orderEmblem } from "@/ui/design-system/kit/order-emblem";

import type { DoorwayRealm } from "./doorway-screen";

/** The doorway's realm, from its Structure row: its name and its Order's emblem. */
export const doorwayRealmOf = (structure: NativeRows["Structure"], store: NativeFactStore): DoorwayRealm | null => {
  if (!isRealmCategory(structure.base.category)) return null;
  const order = Number(structure.metadata.order);
  return {
    name: getStructureName(structure, store).name,
    // Order 0 is a realm with no Order.
    emblem: order === 0 ? null : orderEmblem(order),
  };
};
