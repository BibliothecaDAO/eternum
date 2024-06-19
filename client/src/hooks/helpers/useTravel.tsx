import { EternumGlobalConfig, Position } from "@bibliothecadao/eternum";
import { useDojo } from "../context/DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { calculateDistance } from "@/ui/utils/utils";
import { uuid } from "@latticexyz/utils";
import { useStamina } from "./useStamina";
interface TravelToHexProps {
  travelingEntityId: bigint | undefined;
  directions: number[];
  path: Position[];
  currentArmiesTick: number;
}

export function useTravel() {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { travel_hex },
    },
  } = useDojo();
  const { optimisticStaminaUpdate } = useStamina();

  const computeTravelTime = (fromId: bigint, toId: bigint, speed: number) => {
    const fromPosition = getComponentValue(components.Position, getEntityIdFromKeys([fromId]));
    const toPosition = getComponentValue(components.Position, getEntityIdFromKeys([toId]));
    if (!fromPosition || !toPosition) return;
    const distanceFromPosition = calculateDistance(fromPosition, toPosition) ?? 0;
    return Math.floor(((distanceFromPosition / speed) * 3600) / 60 / 60);
  };

  const optimisticTravelHex = (
    entityId: bigint,
    col: number,
    row: number,
    pathLength: number,
    currentArmiesTick: number,
  ) => {
    let overrideId = uuid();

    const entity = getEntityIdFromKeys([entityId]);

    optimisticStaminaUpdate(
      overrideId,
      entityId,
      EternumGlobalConfig.stamina.travelCost * pathLength,
      currentArmiesTick,
    );

    components.Position.addOverride(overrideId, {
      entity,
      value: {
        entity_id: entityId,
        x: col,
        y: row,
      },
    });
    return overrideId;
  };

  const travelToHex = async ({ travelingEntityId, directions, path, currentArmiesTick }: TravelToHexProps) => {
    if (!travelingEntityId) return;

    const overrideId = optimisticTravelHex(
      travelingEntityId,
      path[path.length - 1].x,
      path[path.length - 1].y,
      path.length - 1,
      currentArmiesTick,
    );

    travel_hex({
      signer: account,
      travelling_entity_id: travelingEntityId,
      directions,
    }).catch(() => {
      components.Position.removeOverride(overrideId);
      components.Stamina.removeOverride(overrideId);
    });
  };

  return { travelToHex, computeTravelTime };
}
