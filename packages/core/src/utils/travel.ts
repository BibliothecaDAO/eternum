import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents, ID } from "@bibliothecadao/types";
import { DEFAULT_COORD_ALT } from "./tile";
import { calculateDistance } from "./utils";

export const computeTravelTime = (
  fromId: ID,
  toId: ID,
  secPerKm: number,
  components: ClientComponents,
  pickup?: boolean,
) => {
  const fromPosition = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(fromId)]));
  const toPosition = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(toId)]));
  if (!fromPosition || !toPosition) return;
  const distanceFromPosition =
    calculateDistance(
      { alt: DEFAULT_COORD_ALT, x: Number(fromPosition.base.coord_x), y: Number(fromPosition.base.coord_y) },
      { alt: DEFAULT_COORD_ALT, x: Number(toPosition.base.coord_x), y: Number(toPosition.base.coord_y) },
    ) ?? 0;

  const onewayTime = Math.floor((distanceFromPosition * secPerKm) / 60);
  return pickup ? onewayTime * 2 : onewayTime;
};
