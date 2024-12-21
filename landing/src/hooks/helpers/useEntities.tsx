import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { execute } from "../gql/execute";
import { GET_ETERNUM_OWNER_REALM_IDS } from "../query/entities";

export const useEntities = () => {
  /*const {
    account: { account },
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();*/

  const { address } = useAccount();

 /* const dojoAddress = ContractAddress(account?.address || "");

  // Get all realms
  const allRealms = useEntityQuery([Has(Realm)]);

  const filterPlayerRealms = useMemo(() => {
    return allRealms.filter((id) => {
      const owner = getComponentValue(Owner, id);
      return owner && ContractAddress(owner.address) === ContractAddress(dojoAddress);
    });
  }, [allRealms, dojoAddress]);

  const playerRealms = useMemo(() => {
    return filterPlayerRealms.map((id) => {
      const realm = getComponentValue(Realm, id);
      return realm;
    });
  }, [filterPlayerRealms]);*/

  const { data, isLoading } = useQuery({
    queryKey: ["entityResources", address],
    queryFn: () => (address ? execute(GET_ETERNUM_OWNER_REALM_IDS, { accountAddress: address }) : null),
    refetchInterval: 10_000,
  });

  return {
    data,
    //playerRealms,
  };
};
