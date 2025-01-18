import { ADMIN_BANK_ENTITY_ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { useDojo } from "../";

export const useBank = () => {
  const {
    setup: {
      components: { Bank, Position, Owner, AddressName },
    },
  } = useDojo();

  const entity = getEntityIdFromKeys([BigInt(ADMIN_BANK_ENTITY_ID)]);

  const position = getComponentValue(Position, entity);
  if (!position) return;

  const owner = getComponentValue(Owner, entity);
  const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(owner?.address || "0x0")]));

  const bank = getComponentValue(Bank, entity);

  return {
    entityId: position.entity_id,
    position: { x: position.x, y: position.y },
    owner: addressName?.name ? shortString.decodeShortString(addressName.name.toString()) : "Bandits",
    ownerFee: bank ? Number(bank.owner_fee_num) / Number(bank.owner_fee_denom) : 0,
    depositFee: bank ? Number(bank.owner_bridge_fee_dpt_percent) : 0,
    withdrawFee: bank ? Number(bank.owner_bridge_fee_wtdr_percent) : 0,
  };
};
