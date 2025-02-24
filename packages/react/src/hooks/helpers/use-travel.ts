import { calculateDistance, ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useDojo } from "../context";

export function useTravel() {
  const {
    setup: { components },
  } = useDojo();

  const computeTravelTime = (fromId: ID, toId: ID, secPerKm: number, pickup?: boolean) => {
    const fromPosition = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(fromId)]));
    const toPosition = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(toId)]));
    if (!fromPosition || !toPosition) return;
    const distanceFromPosition =
      calculateDistance(
        { x: Number(fromPosition.base.coord_x), y: Number(fromPosition.base.coord_y) },
        { x: Number(toPosition.base.coord_x), y: Number(toPosition.base.coord_y) },
      ) ?? 0;

    const onewayTime = Math.floor((distanceFromPosition * secPerKm) / 60);
    return pickup ? onewayTime * 2 : onewayTime;
  };

  return { computeTravelTime };
}
