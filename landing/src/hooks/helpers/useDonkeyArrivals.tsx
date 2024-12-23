import { ADMIN_BANK_ENTITY_ID, ID } from "@bibliothecadao/eternum";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { execute } from "../gql/execute";
import { GetEternumEntityOwnerQuery } from "../gql/graphql";
import { GET_ETERNUM_ENTITY_OWNERS } from "../query/entityOwners";
import { GET_ENTITY_DISTANCE } from "../query/position";
import { GET_ENTITIES_RESOURCES } from "../query/resources";

export function useDonkeyArrivals(realmEntityIds: ID[]) {
    const filteredRealmIds = useMemo(() => 
      realmEntityIds.filter(id => id !== 54),
      [realmEntityIds]
    );
  
    const {
      data: entityPositions,
      isLoading: isLoadingPositions,
      error: positionsError,
    } = useQuery({
      queryKey: ["entityPositionBank"],
      queryFn: () => execute(GET_ENTITY_DISTANCE, { entityIds: [Number(ADMIN_BANK_ENTITY_ID)] }),
    });
  
    const {
      data: donkeyEntities,
      isLoading: isLoadingDonkeyEntityIds,
      error: errorDonkeyEntityIds,
    } = useQuery({
      queryKey: ["donkeyEntityIds", filteredRealmIds],
      queryFn: () => execute(GET_ETERNUM_ENTITY_OWNERS, { entityOwnerIds: filteredRealmIds }),
      enabled: filteredRealmIds.length > 0,
      refetchInterval: 10_000,
    });
  
    const bankPosition = useMemo(
      () =>
        entityPositions?.s0EternumPositionModels?.edges?.find((entity) => entity?.node?.entity_id == ADMIN_BANK_ENTITY_ID)
          ?.node,
      [entityPositions],
    );
  
    const donkeysAtBank = useMemo(() => {
      if (!donkeyEntities?.s0EternumEntityOwnerModels?.edges || !bankPosition) return [];
      
      return donkeyEntities.s0EternumEntityOwnerModels.edges.filter((edge) => {
        const position = edge?.node?.entity?.models?.find(
          (model) => model?.__typename === "s0_eternum_Position"
        );
        const resource = edge?.node?.entity?.models?.find(
          (model) => model?.__typename === "s0_eternum_OwnedResourcesTracker"
        );
        
        return Boolean(
          position?.x === bankPosition?.x &&
          position?.y === bankPosition?.y &&
          resource?.resource_types !== "0x0"
        );
      });
    }, [donkeyEntities, bankPosition]);
  
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
  
    const donkeyInfos = useMemo(() => {
      return donkeysAtBank?.map((donkey) => donkey && getDonkeyInfo(donkey));
    }, [donkeysAtBank, donkeyResources]);
  
    return {
      donkeyArrivals: donkeysAtBank,
      donkeyInfos,
      bankPosition,
      donkeyResources,
      isLoading: isLoadingPositions || isLoadingDonkeyEntityIds,
      error: positionsError || errorDonkeyEntityIds,
    };
  }