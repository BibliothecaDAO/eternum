import { getComponentValue } from "@dojoengine/recs";
import { ClientComponents, ID } from "@bibliothecadao/types";
import { calculateDistance } from "./utils";
import { gameEntityKey } from "../managers/config-manager";

export const computeTravelTime = (
  fromId: ID,
  toId: ID,
  secPerKm: number,
  components: ClientComponents,
  pickup?: boolean,
) => {
  const fromPosition = getComponentValue(components.Structure, gameEntityKey([BigInt(fromId)]));
  const toPosition = getComponentValue(components.Structure, gameEntityKey([BigInt(toId)]));
  if (!fromPosition || !toPosition) return;
  const distanceFromPosition =
    calculateDistance(
      { x: Number(fromPosition.base.coord_x), y: Number(fromPosition.base.coord_y) },
      { x: Number(toPosition.base.coord_x), y: Number(toPosition.base.coord_y) },
    ) ?? 0;

  const onewayTime = Math.floor((distanceFromPosition * secPerKm) / 60);
  return pickup ? onewayTime * 2 : onewayTime;
};
