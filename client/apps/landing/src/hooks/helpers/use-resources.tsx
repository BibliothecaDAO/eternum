// import { ResourceManager } from "@bibliothecadao/eternum";
// import { ClientComponents, ID, ResourcesIds } from "@bibliothecadao/types";
// import { useQuery } from "@tanstack/react-query";
// import { useMemo } from "react";
// import { execute } from "../gql/execute";

// import { ComponentValue } from "@dojoengine/recs";
// import { GET_ENTITIES_RESOURCES } from "../query/resources";

// export function useResourceBalance({ entityId }: { entityId?: ID }) {
//   const { data, isLoading, error } = useQuery({
//     queryKey: ["entityResources", entityId],
//     queryFn: () => (entityId ? execute(GET_ENTITIES_RESOURCES, { entityIds: [entityId] }) : null),
//     refetchInterval: 10_000,
//     staleTime: 5_000,
//   });

//   const getBalance = useMemo(
//     () => (resourceId: ResourcesIds) => {
//       const resource = data?.s1EternumResourceModels?.edges?.[0]?.node;
//       if (!resource) return 0;
//       return Number(
//         ResourceManager.balance(resource as ComponentValue<ClientComponents["Resource"]["schema"]>, resourceId),
//       );
//     },
//     [data],
//   );

//   return { data: data?.s1EternumResourceModels?.edges, isLoading, error, getBalance };
// }
