import { ID, MERCENARIES, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { getComponentValue, getComponentValueStrict } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { useDojo } from "../";

export const useBank = (bankEntityId: ID) => {
  const {
    setup: {
      components: { AddressName, Structure, WorldConfig },
    },
  } = useDojo();

  const entity = getEntityIdFromKeys([BigInt(bankEntityId)]);

  const structure = getComponentValueStrict(Structure, entity);

  const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(structure.owner)]));
  const bankConfig = getComponentValue(WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]))?.bank_config;
  return {
    entityId: structure.entity_id,
    position: { x: structure.base.coord_x, y: structure.base.coord_y },
    owner: addressName?.name ? shortString.decodeShortString(addressName.name.toString()) : MERCENARIES,
    structure,
    ownerFee: Number(bankConfig?.owner_fee_num) / Number(bankConfig?.owner_fee_denom),
  };
};
