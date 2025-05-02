// import { getRealmNameById } from "@bibliothecadao/eternum";
// import { useAccount } from "@starknet-react/core";
// import { useQuery } from "@tanstack/react-query";
// import { useMemo } from "react";
// import { execute } from "../gql/execute";
// import { GET_ETERNUM_OWNER_REALM_IDS } from "../query/entities";

// interface s1EternumRealm {
//   __typename: "s1_eternum_Realm";
//   realm_id: number;
// }

// function iss1EternumRealm(model: any): model is s1EternumRealm {
//   return model?.__typename === "s1_eternum_Realm";
// }

// function iss1EternumStructure(model: any) {
//   return model?.__typename === "s1_eternum_Structure";
// }

// export const useEntities = () => {
//   const { address } = useAccount();

//   const { data, isLoading } = useQuery({
//     queryKey: ["entityResources", address],
//     queryFn: () => (address ? execute(GET_ETERNUM_OWNER_REALM_IDS, { accountAddress: address }) : null),
//     refetchInterval: 10_000,
//   });

//   const playerRealms = useMemo(() => {
//     if (!data) return [];

//     return data.s1EternumStructureModels?.edges
//       ?.map((structure) => {
//         const realmId = structure?.node?.metadata?.realm_id;
//         return {
//           realmId,
//           entityId: structure?.node?.entity_id,
//           name: getRealmNameById(realmId ?? 0),
//         };
//       })
//       .filter(Boolean) as { realmId: number; entityId: number; name: string }[];
//   }, [data, getRealmNameById]);

//   const playerStructures = useMemo(() => {
//     if (!data) return [];

//     return data.s1EternumStructureModels?.edges
//       ?.map((structure) => {
//         const entityId = structure?.node?.entity_id;
//         const realmId = structure?.node?.metadata?.realm_id;
//         return {
//           realmId,
//           entityId,
//           name: getRealmNameById(realmId ?? 0),
//         };
//       })
//       .filter(Boolean) as { realmId: number | undefined; entityId: number; name: string }[];
//   }, [data, getRealmNameById]);

//   return {
//     playerRealms,
//     playerStructures,
//     isLoading,
//   };
// };
