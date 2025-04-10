import { ResourcesIds } from "@bibliothecadao/types";

import {
  RESOURCE_PRODUCTION_COMPLEX_SYSTEM,
  RESOURCE_PRODUCTION_INPUT_RESOURCES,
} from "../environments/utils/resource";

// T1 Troop types we're calculating for
const T1_TROOPS = [ResourcesIds.Paladin, ResourcesIds.Crossbowman, ResourcesIds.Knight];

// Function to calculate labor cost for a specific resource
function calculateLaborCostForResource(resourceId: ResourcesIds): number {
  const laborParams = RESOURCE_PRODUCTION_COMPLEX_SYSTEM[resourceId];

  if (!laborParams) {
    return 0;
  }

  return laborParams.resource_rarity;
}

// Function to calculate the labor cost for a troop based on its input resources
function calculateTroopLaborCost(troopId: ResourcesIds): number {
  const troopInputs = RESOURCE_PRODUCTION_INPUT_RESOURCES[troopId] || [];
  let totalLaborCost = 0;

  // Only consider resources that are not Wheat or Fish (as those are food)
  const resourceInputs = troopInputs.filter(
    (input) => input.resource !== ResourcesIds.Wheat && input.resource !== ResourcesIds.Fish,
  );

  for (const input of resourceInputs) {
    const resourceRarity = calculateLaborCostForResource(input.resource);
    totalLaborCost += resourceRarity * input.amount;
  }

  return totalLaborCost;
}

// Calculate labor costs for each T1 troop
function calculateTroopLaborCosts() {
  const results: Record<
    string,
    {
      inputs: { resource: ResourcesIds; amount: number; rarity: number }[];
      totalLaborCost: number;
    }
  > = {};

  for (const troopId of T1_TROOPS) {
    const troopInputs = RESOURCE_PRODUCTION_INPUT_RESOURCES[troopId] || [];
    const resourceInputs = troopInputs.filter(
      (input) => input.resource !== ResourcesIds.Wheat && input.resource !== ResourcesIds.Fish,
    );

    const inputs = resourceInputs.map((input) => ({
      resource: input.resource,
      amount: input.amount,
      rarity: calculateLaborCostForResource(input.resource),
    }));

    const totalLaborCost = calculateTroopLaborCost(troopId);

    // Get troop name from ResourceIds
    const troopName = ResourcesIds[troopId];

    results[troopName] = {
      inputs,
      totalLaborCost,
    };
  }

  return results;
}

// Run the calculation and print results
const troopLaborCosts = calculateTroopLaborCosts();

console.log("Troop Labor Costs:");
console.log(JSON.stringify(troopLaborCosts, null, 2));

// Print a summary of just the final labor costs
console.log("\nSummary of Labor Costs:");
for (const [troopName, data] of Object.entries(troopLaborCosts)) {
  console.log(`${troopName}: ${data.totalLaborCost}`);
}
