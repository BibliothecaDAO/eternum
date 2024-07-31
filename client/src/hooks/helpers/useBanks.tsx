import { ContractAddress, ID, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";

export const useGetBanks = (onlyMine?: boolean) => {
  const {
    account: { account },
    setup: {
      components: { Bank, Position, Owner },
    },
  } = useDojo();

  const query = onlyMine ? [Has(Bank), HasValue(Owner, { address: ContractAddress(account.address) })] : [Has(Bank)];
  const entityIds = useEntityQuery(query);

  return entityIds
    .map((entityId) => {
      const position = getComponentValue(Position, entityId);
      if (!position) return;

      return {
        entityId: position.entity_id,
        position: { x: position.x, y: position.y },
      };
    })
    .filter(Boolean) as { entityId: ID; position: Position }[];
};
