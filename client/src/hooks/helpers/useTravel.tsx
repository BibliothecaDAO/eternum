import { Position } from "@bibliothecadao/eternum";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
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
      systemCalls: { travel_hex },
    },
  } = useDojo();

  const travelToHex = async ({ travelingEntityId, directions, path }: TravelToHexProps) => {
    if (!travelingEntityId) return;
    setAnimationPaths([...animationPaths, { id: travelingEntityId, path, enemy: false }]);
    await travel_hex({
      signer: account,
      travelling_entity_id: travelingEntityId,
      directions,
    });
  };

  return { travelToHex };
}
