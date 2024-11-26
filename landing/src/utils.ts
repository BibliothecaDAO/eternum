

interface Position {
    x: number;
    y: number;
}
export function calculateDistance(start: Position, destination: Position): number | undefined {
    // d = √((x2-x1)² + (y2-y1)²)
  
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



import { configManager } from "@/dojo/setup";
import { CapacityConfigCategory, Resource } from "@bibliothecadao/eternum";
import { divideByPrecision } from "./lib/utils";

export const getTotalResourceWeight = (resources: Array<Resource | undefined>) => {
    return resources.reduce(
      (total, resource) =>
        total + (resource ? resource.amount * configManager.getResourceWeight(resource.resourceId) || 0 : 0),
      0,
    );
  };


export const calculateDonkeysNeeded = (orderWeight: number): number => {
    return Math.ceil(divideByPrecision(orderWeight) / configManager.getCapacityConfig(CapacityConfigCategory.Donkey));
};
  