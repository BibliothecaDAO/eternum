import { ContractAddress } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context/DojoContext";

export const useEntities = () => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const address = ContractAddress(account?.address || "");

  // Get all realms
  const allRealms = useEntityQuery([Has(Realm)]);

  const filterPlayerRealms = useMemo(() => {
    return allRealms.filter((id) => {
      const owner = getComponentValue(Owner, id);
      return owner && ContractAddress(owner.address) === ContractAddress(address);
    });
  }, [allRealms, address]);

  const playerRealms = useMemo(() => {
    return filterPlayerRealms.map((id) => {
      const realm = getComponentValue(Realm, id);
      return realm;
    });
  }, [filterPlayerRealms]);

  return {
    playerRealms,
  };
};
