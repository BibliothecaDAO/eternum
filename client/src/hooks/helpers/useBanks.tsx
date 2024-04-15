import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";

export const useBanks = () => {
  const {
    account: { account },
    setup: {
      components: { BankAccounts },
    },
  } = useDojo();

  const getMyAccounts = (bankEntityId: bigint) => {
    const entityIds = runQuery([
      HasValue(BankAccounts, { bank_entity_id: bankEntityId, owner: BigInt(account.address) }),
    ]);
    return Array.from(entityIds)
      .map((entityId) => {
        const position = getComponentValue(BankAccounts, entityId);
        if (!position) return;
        return position?.entity_id;
      })
      .filter(Boolean) as bigint[];
  };

  return {
    getMyAccounts,
  };
};

export const useGetBanks = () => {
  const {
    setup: {
      components: { Bank, Position },
    },
  } = useDojo();

  const entityIds = useEntityQuery([Has(Bank)]);

  return entityIds
    .map((entityId) => {
      const position = getComponentValue(Position, entityId);
      if (!position) return;

      return {
        entityId: position.entity_id,
        position,
      };
    })
    .filter(Boolean) as { entityId: bigint; position: Position }[];
};
