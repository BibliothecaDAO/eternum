import { calculateDistance } from "@/utils";
import { ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useDojo } from "./context/DojoContext";

export function useTravel() {
  const {
    setup: { components },
  } = useDojo();

  const computeTravelTime = (fromId: ID, toId: ID, secPerKm: number, pickup?: boolean) => {
    const fromPosition = getComponentValue(components.Position, getEntityIdFromKeys([BigInt(fromId)]));
    const toPosition = getComponentValue(components.Position, getEntityIdFromKeys([BigInt(toId)]));
    if (!fromPosition || !toPosition) return;
    const distanceFromPosition =
      calculateDistance(
        { x: Number(fromPosition.x), y: Number(fromPosition.y) },
        { x: Number(toPosition.x), y: Number(toPosition.y) },
      ) ?? 0;

    const onewayTime = Math.floor((distanceFromPosition * secPerKm) / 60);
    return pickup ? onewayTime * 2 : onewayTime;
  };

  return { computeTravelTime };
}
