import { sqlApi } from "@/app/services/api";
import { ID } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";

export const useGuardsByStructure = (structureEntityId: ID) => {
  const { data: guards = [], isLoading } = useQuery({
    queryKey: ["guards", String(structureEntityId)],
    queryFn: async () => {
      if (!structureEntityId) return [];
      const guards = await sqlApi.fetchGuardsByStructure(structureEntityId);
      return guards.filter((guard) => guard.troops?.count && guard.troops.count > 0n);
    },
    staleTime: 10000,
    enabled: !!structureEntityId,
  });

  return {
    guards,
    isLoading,
    count: guards.length,
  };
};
