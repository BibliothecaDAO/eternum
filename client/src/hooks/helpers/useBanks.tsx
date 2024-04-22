import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";

export const useBanks = () => {
  const {
    account: { account },
    setup: {
      components: { BankAccounts, Position },
    },
  } = useDojo();

  const useMyAccountsInBank = (bankEntityId: bigint) => {
    const entityIds = useEntityQuery([
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
    useMyAccountsInBank,
  };
};

export const useGetBanks = (onlyMine?: boolean) => {
  const {
    account: { account },
    setup: {
      components: { Bank, Position, Owner },
    },
  } = useDojo();

  const query = onlyMine ? [Has(Bank), HasValue(Owner, { address: BigInt(account.address) })] : [Has(Bank)];
  const entityIds = useEntityQuery(query);

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
