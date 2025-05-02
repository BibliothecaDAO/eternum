// import { ADMIN_BANK_ENTITY_ID, ID, Resource } from "@bibliothecadao/types";

// import { useQueries, useQuery } from "@tanstack/react-query";
// import { useMemo } from "react";
// import { execute } from "../gql/execute";
// import { GetEternumEntityOwnerQuery } from "../gql/graphql";
// import { GET_ETERNUM_ENTITY_OWNERS } from "../query/entity-owners";
// import { GET_ENTITY_DISTANCE } from "../query/position";
// import { GET_ENTITIES_RESOURCES } from "../query/resources";

// const BATCH_SIZE = 5;

// export function useDonkeyArrivals(realmEntityIds: ID[]) {
//   const {
//     data: entityPositions,
//     isLoading: isLoadingPositions,
//     error: positionsError,
//   } = useQuery({
//     queryKey: ["entityPositionBank"],
//     queryFn: () => execute(GET_ENTITY_DISTANCE, { entityIds: [Number(ADMIN_BANK_ENTITY_ID)] }),
//   });

//   const batchedRealmIds = useMemo(() => {
//     const batches = [];
//     for (let i = 0; i < realmEntityIds.length; i += BATCH_SIZE) {
//       batches.push(realmEntityIds.slice(i, i + BATCH_SIZE));
//     }
//     return batches;
//   }, [realmEntityIds]);

//   const donkeyQueriesResults = useQueries({
//     queries: batchedRealmIds.map((realmIds) => ({
//       queryKey: ["donkeyEntityIds", realmIds],
//       queryFn: () => execute(GET_ETERNUM_ENTITY_OWNERS, { entityOwnerIds: realmIds }),
//       enabled: !!realmIds,
//       staleTime: 5 * 60 * 1000,
//     })),
//   });

//   const donkeyEntities = useMemo(
//     () => ({
//       s1EternumResourceArrivalModels: {
//         edges: donkeyQueriesResults
//           .filter((result) => result.data)
//           .flatMap((result) => result.data?.s1EternumResourceArrivalModels?.edges || []),
//       },
//     }),
//     [donkeyQueriesResults],
//   );

//   const isLoadingDonkeyEntityIds = donkeyQueriesResults.some((result) => result.isLoading);
//   const errorDonkeyEntityIds = donkeyQueriesResults.find((result) => result.error)?.error;

//   const bankPosition = useMemo(
//     () =>
//       entityPositions?.s1EternumStructureModels?.edges?.find(
//         (entity) => entity?.node?.entity_id == ADMIN_BANK_ENTITY_ID,
//       )?.node,
//     [entityPositions],
//   );

//   // const donkeysAtBank = useMemo(() => {
//   //   if (!donkeyEntities?.s1EternumResourceArrivalModels?.edges || !bankPosition) return [];

//   //   return donkeyEntities.s1EternumResourceArrivalModels.edges.filter((edge) => {
//   //     const position = edge?.node?.structure_id?.models?.find((model) => model?.__typename === "s1_eternum_Position");
//   //     const resource = edge?.node?.entity?.models?.find(
//   //       (model) => model?.__typename === "s1_eternum_OwnedResourcesTracker",
//   //     );

//   //     return Boolean(
//   //       position?.x === bankPosition?.x && position?.y === bankPosition?.y && resource?.resource_types !== "0x0",
//   //     );
//   //   });
//   // }, [donkeyEntities, bankPosition]);

//   // const donkeyEntityIds = useMemo(
//   //   () => donkeysAtBank?.map((edge) => edge?.node?.entity_id).filter((id): id is number => id != null) ?? [],
//   //   [donkeysAtBank],
//   // );

//   const donkeysAtBank: NonNullable<
//     NonNullable<NonNullable<GetEternumEntityOwnerQuery["s1EternumResourceArrivalModels"]>["edges"]>[number]
//   >[] = [];

//   // todo: fix
//   const donkeyEntityIds: ID[] = [1, 2, 3];

//   const { data: donkeyResources } = useQuery({
//     queryKey: ["donkeyResources" + donkeyEntityIds],
//     queryFn: () => execute(GET_ENTITIES_RESOURCES, { entityIds: donkeyEntityIds }),
//     enabled: !!donkeyEntityIds,
//   });

//   const getDonkeyInfo = (
//     donkeyEntity: NonNullable<
//       NonNullable<NonNullable<GetEternumEntityOwnerQuery["s1EternumResourceArrivalModels"]>["edges"]>[number]
//     >,
//   ): { donkeyEntityId: ID; donkeyArrivalTime: bigint; donkeyResourceBalances: Resource[] } => {
//     // const donkeyArrivalTime = donkeyEntity?.node?.entity?.models?.find(
//     //   (model) => model?.__typename === "s1_eternum_ArrivalTime",
//     // )?.arrives_at;

//     // const donkeyResourceBalances =
//     //   donkeyResources?.s1EternumResourceModels?.edges
//     //     ?.filter((edge) => edge?.node?.entity_id === donkeyEntityId)
//     //     ?.map((edge) => edge?.node)
//     //     ?.map((node) => ({
//     //       resourceId: node?.resource_type,
//     //       amount: node?.balance,
//     //     }))
//     //     .filter((r) => Number(r.amount) > 0) ?? [];

//     return { donkeyEntityId: 0, donkeyArrivalTime: 0n, donkeyResourceBalances: [] };
//   };

//   const donkeyInfos = useMemo(() => {
//     return donkeysAtBank
//       ?.map((donkey) => donkey && getDonkeyInfo(donkey))
//       .filter((info) => info?.donkeyResourceBalances.some((balance) => Number(balance.amount) > 0));
//   }, [donkeyEntityIds, donkeyResources]);

//   return {
//     donkeyArrivals: donkeysAtBank,
//     donkeyInfos,
//     bankPosition,
//     donkeyResources,
//     isLoading: isLoadingPositions || isLoadingDonkeyEntityIds,
//     error: positionsError || errorDonkeyEntityIds,
//   };
// }
