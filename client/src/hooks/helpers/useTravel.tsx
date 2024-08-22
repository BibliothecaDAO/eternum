import { calculateDistance } from "@/ui/utils/utils";
import { ConfigManager, ID, Position } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { useDojo } from "../context/DojoContext";
import { useStamina } from "./useStamina";
interface TravelToHexProps {
  travelingEntityId: ID | undefined;
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
  const staminaCost = ConfigManager.instance().getConfig().staminaCost;
  const { optimisticStaminaUpdate } = useStamina();

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

  const optimisticTravelHex = (
    entityId: ID,
    col: number,
    row: number,
    pathLength: number,
    currentArmiesTick: number,
  ) => {
    let overrideId = uuid();

    const entity = getEntityIdFromKeys([BigInt(entityId)]);

    optimisticStaminaUpdate(overrideId, entityId, staminaCost.travel * pathLength, currentArmiesTick);

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
