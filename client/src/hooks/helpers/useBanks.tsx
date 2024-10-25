import { ContractAddress, ID, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useDojo } from "../context/DojoContext";

export const useGetBanks = (onlyMine?: boolean) => {
  const {
    account: { account },
    setup: {
      components: { Bank, Position, Owner, AddressName },
    },
  } = useDojo();

  const query = onlyMine ? [Has(Bank), HasValue(Owner, { address: ContractAddress(account.address) })] : [Has(Bank)];
  const entityIds = useEntityQuery(query);

  return entityIds
    .map((entityId) => {
      const position = getComponentValue(Position, entityId);
      if (!position) return;

      const owner = getComponentValue(Owner, entityId);
      const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(owner?.address || "0x0")]));

      const bank = getComponentValue(Bank, entityId);

      return {
        entityId: position.entity_id,
        position: { x: position.x, y: position.y },
        owner: addressName?.name || "Bandits",
        ownerFee: bank ? Number(bank.owner_fee_num) / Number(bank.owner_fee_denom) : 0,
        depositFee: bank ? Number(bank.owner_bridge_fee_dpt_percent) : 0,
        withdrawFee: bank ? Number(bank.owner_bridge_fee_wtdr_percent) : 0,
      };
    })
    .filter(Boolean) as {
    entityId: ID;
    position: Position;
    owner: string;
    ownerFee: number;
    depositFee: number;
    withdrawFee: number;
  }[];
};
