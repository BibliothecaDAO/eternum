import { ADMIN_BANK_ENTITY_ID } from "@bibliothecadao/eternum";
import { getComponentValue, getComponentValueStrict } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { useDojo } from "../";

export const useBank = () => {
  const {
    setup: {
      components: { Bank, AddressName, Structure },
    },
  } = useDojo();

  const entity = getEntityIdFromKeys([BigInt(ADMIN_BANK_ENTITY_ID)]);

  // use strict because we know the entity exists
  const structure = getComponentValueStrict(Structure, entity);
  const bank = getComponentValueStrict(Bank, entity);

  const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(structure.owner)]));

  return {
    entityId: structure.entity_id,
    position: { x: structure.base.coord_x, y: structure.base.coord_y },
    owner: addressName?.name ? shortString.decodeShortString(addressName.name.toString()) : "Bandits",
    ownerFee: Number(bank.owner_fee_num) / Number(bank.owner_fee_denom),
    depositFee: Number(bank.owner_bridge_fee_dpt_percent),
    withdrawFee: Number(bank.owner_bridge_fee_wtdr_percent),
  };
};
