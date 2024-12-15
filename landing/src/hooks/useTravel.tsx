import { ID } from "@bibliothecadao/eternum";
import { useQuery } from "@tanstack/react-query";
import { calculateDistance } from "../components/ui/utils/utils";
import { execute } from "./gql/execute";
import { GET_ENTITY_DISTANCE } from "./query/position";

export function useTravel(fromId: ID, toId: ID, secPerKm: number, pickup?: boolean) {
  const { data: entityPositions, isLoading } = useQuery({
    queryKey: ["entityResources", fromId, toId],
    queryFn: () => execute(GET_ENTITY_DISTANCE, { fromEntityId: fromId, toEntityId: toId }),
    refetchInterval: 10_000,
  });
  

  const computeTravelTime = (fromId: ID, toId: ID, secPerKm: number, pickup?: boolean) => {
    const fromPosition = entityPositions?.s0EternumPositionModels?.edges?.find((entity)=> entity?.node?.entity_id == fromId);
    const toPosition = entityPositions?.s0EternumPositionModels?.edges?.find((entity)=> entity?.node?.entity_id == toId);
    if (!fromPosition || !toPosition) return;
    const distanceFromPosition =
      calculateDistance(
        { x: Number(fromPosition?.node?.x), y: Number(fromPosition?.node?.y) },
        { x: Number(toPosition?.node?.x), y: Number(toPosition?.node?.y) },
      ) ?? 0;

    const onewayTime = Math.floor((distanceFromPosition * secPerKm) / 60);
    return pickup ? onewayTime * 2 : onewayTime;
  };

  return { computeTravelTime };
}
