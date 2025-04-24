import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

export const getExplorerFromToriiEntity = (
  entity: any,
): ComponentValue<ClientComponents["ExplorerTroops"]["schema"]> => {
  return {
    explorer_id: entity.explorer_id.value,
    owner: entity.owner.value,
    troops: {
      category: entity.troops.value.category.value.option,
      tier: entity.troops.value.tier.value.option,
      count: BigInt(entity.troops.value.count.value),
      stamina: {
        amount: BigInt(entity.troops.value.stamina.value.amount.value),
        updated_tick: BigInt(entity.troops.value.stamina.value.updated_tick.value),
      },
    },
    coord: {
      x: entity.coord.value.x.value,
      y: entity.coord.value.y.value,
    },
  };
};
