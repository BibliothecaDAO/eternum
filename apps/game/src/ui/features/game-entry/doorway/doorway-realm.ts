import { getRealmNameById } from "@bibliothecadao/eternum";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { realmStill } from "@/shell/mode-art";
import { orderEmblem } from "@/ui/features/frontier/board/order-emblem";

import type { DoorwayRealm } from "./doorway-screen";

/** The doorway's realm, from its Structure row: its name, its Order's emblem, and the still for its castle level. */
export const doorwayRealmOf = (structure: NativeRows["Structure"]): DoorwayRealm | null => {
  if (!isRealmCategory(structure.base.category)) return null;
  const order = Number(structure.metadata.order);
  return {
    name: getRealmNameById(structure.metadata.realm_id),
    // Order 0 is a realm with no Order.
    emblem: order === 0 ? null : orderEmblem(order),
    still: realmStill(Number(structure.base.level)),
  };
};
