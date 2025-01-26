import { ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { execute } from "../gql/execute";

import { GET_ENTITIES_RESOURCES } from "../query/resources";

export function useResourceBalance({ entityId, resourceId }: { entityId?: ID; resourceId?: ResourcesIds }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["entityResources", entityId],
    queryFn: () => (entityId ? execute(GET_ENTITIES_RESOURCES, { entityIds: [entityId] }) : null),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const getBalance = useMemo(
    () => (resourceId: ResourcesIds) => {
      return (
        data?.s1EternumResourceModels?.edges?.find((r) => r?.node?.resource_type === resourceId)?.node?.balance ?? 0
      );
    },
    [data],
  );

  return { data: data?.s1EternumResourceModels?.edges, isLoading, error, getBalance };
}
