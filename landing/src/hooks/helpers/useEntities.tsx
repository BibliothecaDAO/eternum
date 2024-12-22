import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { execute } from "../gql/execute";
import { GET_ETERNUM_OWNER_REALM_IDS } from "../query/entities";
import { useRealm } from "./useRealms";

export interface S0EternumRealm {
  __typename: "s0_eternum_Realm";
  realm_id: number;
}

export function isS0EternumRealm(model: any): model is S0EternumRealm {
  return model?.__typename === "s0_eternum_Realm";
}

export const useEntities = () => {
  const { address } = useAccount();
  const { getRealmNameById } = useRealm();

  const { data, isLoading } = useQuery({
    queryKey: ["entityResources", address],
    queryFn: () => (address ? execute(GET_ETERNUM_OWNER_REALM_IDS, { accountAddress: address }) : null),
    refetchInterval: 10_000,
  });

  const playerRealms = useMemo(() => {
    if (!data) return [];

    return data.s0EternumOwnerModels?.edges
      ?.map((realm) => {
        const realmModel = realm?.node?.entity?.models?.find(isS0EternumRealm);
        if (!realmModel) return null;
        return {
          realmId: realmModel?.realm_id,
          entityId: realm?.node?.entity_id,
          name: getRealmNameById(realmModel?.realm_id ?? 0),
        };
      })
      .filter(Boolean) as { realmId: number; entityId: number; name: string }[];
  }, [data, getRealmNameById]);

  return {
    playerRealms,
    isLoading,
  };
};
