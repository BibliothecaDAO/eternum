import { Position, SPEED_PER_DONKEY } from "@bibliothecadao/eternum";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { calculateDistance } from "@/ui/utils/utils";
interface TravelToHexProps {
  travelingEntityId: bigint | undefined;
  directions: number[];
  path: Position[];
}

export function useTravel() {
  const setAnimationPaths = useUIStore((state) => state.setAnimationPaths);
  const animationPaths = useUIStore((state) => state.animationPaths);
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { travel_hex },
    },
  } = useDojo();

  const computeTravelTime = (fromId: bigint, toId: bigint, speed: number) => {
    const fromPosition = getComponentValue(components.Position, getEntityIdFromKeys([fromId]));
    const toPosition = getComponentValue(components.Position, getEntityIdFromKeys([toId]));
    if (!fromPosition || !toPosition) return;
    const distanceFromPosition = calculateDistance(fromPosition, toPosition) ?? 0;
    return Math.floor(((distanceFromPosition / speed) * 3600) / 60 / 60);
  };

  const travelToHex = async ({ travelingEntityId, directions, path }: TravelToHexProps) => {
    if (!travelingEntityId) return;
    setAnimationPaths([...animationPaths, { id: travelingEntityId, path, enemy: false }]);
    await travel_hex({
      signer: account,
      travelling_entity_id: travelingEntityId,
      directions,
    }).catch(() => {
      // revert animation so that it goes back to the original position
      setAnimationPaths([...animationPaths, { id: travelingEntityId, path: path.reverse(), enemy: false }]);
    });
  };

  return { travelToHex, computeTravelTime };
}
