import { ID } from "@bibliothecadao/types";
// import { GET_ENTITY_DISTANCE } from "./query/position";

export function useTravel(fromId: ID, toId: ID, secPerKm: number, pickup?: boolean) {
  // const { data: entityPositions, isLoading } = useQuery({
  //   queryKey: ["entityPosition", fromId, toId],
  //   queryFn: () => execute(GET_ENTITY_DISTANCE, { entityIds: [fromId, toId] }),
  //   refetchInterval: 10_000,
  // });

  // const computeTravelTime = (fromId: ID, toId: ID, secPerKm: number, pickup?: boolean) => {
  //   const fromPosition = entityPositions?.s1EternumStructureModels?.edges?.find(
  //     (entity) => entity?.node?.entity_id == fromId,
  //   )?.node?.base;
  //   const toPosition = entityPositions?.s1EternumStructureModels?.edges?.find(
  //     (entity) => entity?.node?.entity_id == toId,
  //   )?.node?.base;
  //   if (!fromPosition || !toPosition) return;
  //   const distanceFromPosition =
  //     calculateDistance(
  //       { x: Number(fromPosition?.coord_x), y: Number(fromPosition?.coord_y) },
  //       { x: Number(toPosition?.coord_x), y: Number(toPosition?.coord_y) },
  //     ) ?? 0;

  //   const onewayTime = Math.floor((distanceFromPosition * secPerKm) / 60);
  //   return pickup ? onewayTime * 2 : onewayTime;
  // };

  return {};
}
