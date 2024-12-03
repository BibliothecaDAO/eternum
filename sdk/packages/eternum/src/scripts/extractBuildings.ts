import * as fs from "fs";
import { BUILDING_COSTS, BuildingType, ResourcesIds } from "../constants";

const buildingCosts = Object.entries(BUILDING_COSTS).reduce((output, [buildingId, costs]) => {
  const buildingName = BuildingType[Number(buildingId)].toUpperCase();

  if (costs.length === 0) {
    return output + `${buildingName}\n`;
  }

  output += `${buildingName}:\n`;
  for (const cost of costs) {
    const resourceName = ResourcesIds[cost.resource];
    output += `  ${resourceName}: ${cost.amount}\n`;
  }
  output += "\n";

  return output;
}, "");

// Write to file
fs.writeFileSync("buildingCosts.ts", `export const BUILDING_COSTS_TEXT = \`${buildingCosts}\`;`);
