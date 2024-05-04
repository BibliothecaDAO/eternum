import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { Position } from "@bibliothecadao/eternum";

export function useCaravan() {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  function calculateDistance(startId: bigint, destinationId: bigint): number | undefined {
    // d = √((x2-x1)² + (y2-y1)²)
    let start = getComponentValue(Position, getEntityIdFromKeys([startId]));
    let destination = getComponentValue(Position, getEntityIdFromKeys([destinationId]));
    if (start && destination) {
      // Calculate the difference in x and y coordinates
      const deltaX = Math.abs(start.x - destination.x);
      const deltaY = Math.abs(start.y - destination.y);

      // Calculate the distance using the Pythagorean theorem
      // Each tile is 1 km, so we don't need to divide by 10000 here
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      return distance;
    }
  }

  return {
    calculateDistance,
  };
}
