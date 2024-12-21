import { ADMIN_BANK_ENTITY_ID, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { execute } from "../gql/execute";
import { GetEternumEntityOwnerQuery } from "../gql/graphql";
import { GET_ETERNUM_ENTITY_OWNERS } from "../query/entityOwners";
import { GET_ENTITY_DISTANCE } from "../query/position";
import { GET_ENTITIES_RESOURCES } from "../query/resources";

export function useResourceBalance({ entityId, resourceId }: { entityId?: ID; resourceId?: ResourcesIds }) {
  const { data, isLoading } = useQuery({
    queryKey: ["entityResources", entityId],
    queryFn: () =>
      entityId ? execute(GET_ENTITIES_RESOURCES, { entityIds: [entityId] }) : null,
    refetchInterval: 10_000,
  });

  const getBalance = (resourceId: ResourcesIds) => {
    return data?.s0EternumResourceModels?.edges?.find((r) => r?.node?.resource_type === resourceId)?.node?.balance ?? 0;
  };

  return { data: data?.s0EternumResourceModels?.edges, isLoading, getBalance };
}

export function useDonkeyArrivals(realmEntityIds: ID[]) {
  const {
    data: entityPositions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["entityPositionBank"],
    queryFn: () => execute(GET_ENTITY_DISTANCE, { entityIds: [Number(ADMIN_BANK_ENTITY_ID)] }),
  });

  const {
    data: donkeyEntities,
    isLoading: isLoadingDonkeyEntityIds,
    error: errorDonkeyEntityIds,
  } = useQuery({
    queryKey: ["donkeyEntityIds" + realmEntityIds],
    queryFn: () => execute(GET_ETERNUM_ENTITY_OWNERS, { entityOwnerIds: realmEntityIds }),
  });


  const bankPosition = useMemo(
    () =>
      entityPositions?.s0EternumPositionModels?.edges?.find((entity) => entity?.node?.entity_id == ADMIN_BANK_ENTITY_ID)
        ?.node,
    [entityPositions],
  );



  const donkeysAtBank = useMemo(() => 
    donkeyEntities?.s0EternumEntityOwnerModels?.edges?.filter((edge) => {
      const position = edge?.node?.entity?.models?.find(
        (model) => model?.__typename === "s0_eternum_Position"
      );
      
      return position?.x === bankPosition?.x && 
             position?.y === bankPosition?.y;
    }) ?? []
  , [donkeyEntities, bankPosition]);

  const donkeyEntityIds = useMemo(
    () =>
      donkeysAtBank?.map((edge) => edge?.node?.entity_id)
        .filter((id): id is number => id != null) ?? [],
    [donkeysAtBank],
  );

  const { data: donkeyResources } = useQuery({
    queryKey: ["donkeyResources" + donkeyEntityIds],
    queryFn: () => execute(GET_ENTITIES_RESOURCES, { entityIds: donkeyEntityIds }),
    enabled: !!donkeyEntityIds,
  });

  const getDonkeyInfo = (
    donkeyEntity: NonNullable<
      NonNullable<NonNullable<GetEternumEntityOwnerQuery["s0EternumEntityOwnerModels"]>["edges"]>[number]
    >,
  ) => {
    const donkeyEntityId = donkeyEntity?.node?.entity_id;
    const donkeyArrivalTime = donkeyEntity?.node?.entity?.models?.find(
      (model) => model?.__typename === "s0_eternum_ArrivalTime",
    )?.arrives_at;

    const donkeyResourceBalances =
      donkeyResources?.s0EternumResourceModels?.edges
        ?.filter((edge) => edge?.node?.entity_id === donkeyEntityId)
        ?.map((edge) => edge?.node)
        ?.map((node) => ({
          resourceId: node?.resource_type,
          amount: node?.balance,
        }))
        .filter((r) => Number(r.amount) > 0) ?? [];

    return { donkeyEntityId, donkeyArrivalTime, donkeyResourceBalances };
  };

  return {
    donkeyArrivals: donkeyEntities?.s0EternumEntityOwnerModels?.edges,
    getDonkeyInfo,
    bankPosition,
    donkeyResources,
  };
}
