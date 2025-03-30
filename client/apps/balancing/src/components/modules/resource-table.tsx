import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  COMPLEX_BUILDING_COSTS_SCALED,
  RESOURCE_COMPLEX_BUILDING_COSTS,
  RESOURCE_PRODUCTION_INPUT_RESOURCES_SCALED,
  RESOURCE_PRODUCTION_OUTPUT_AMOUNTS,
  RESOURCE_RARITY,
  RESOURCE_TIERS,
  Resources,
  WEIGHTS_GRAM,
} from "@bibliothecadao/eternum";
import { Badge } from "../ui/badge";

export const ResourceTable = ({ resources }: { resources: Resources[] }) => {
  const resourceName = (id: number) => {
    return resources.find((resource) => resource.id === id)?.trait;
  };

  const resourceColor = (id: number) => {
    return resources.find((resource) => resource.id === id)?.colour;
  };

  const getResourceDescription = (id: number) => {
    return resources.find((resource) => resource.id === id)?.description || "No description available.";
  };

  const getResourceImage = (id: number) => {
    return resources.find((resource) => resource.id === id)?.img || "";
  };

  const getResourceWeight = (id: number) => {
    return WEIGHTS_GRAM[id as keyof typeof WEIGHTS_GRAM] || 0;
  };

  const getResourceTier = (id: number) => {
    for (const [tier, ids] of Object.entries(RESOURCE_TIERS)) {
      if (ids.includes(id as any)) {
        return tier.charAt(0).toUpperCase() + tier.slice(1);
      }
    }
    return "Unknown";
  };

  // New function to calculate adjusted resource inputs based on rarity
  const getAdjustedResourceInputs = (resourceId: number) => {
    const multiplier = RESOURCE_RARITY[resourceId as keyof typeof RESOURCE_RARITY] || 1; // Default multiplier is 1

    return (
      RESOURCE_PRODUCTION_INPUT_RESOURCES_SCALED[resourceId]?.map((input) => ({
        ...input,
        adjustedAmount: input.amount * multiplier,
      })) || []
    );
  };
  // Sum up how many times each resource is used as an input based on RESOURCE_PRODUCTION_INPUT_RESOURCES_SCALED and COMPLEX_BUILDING_COSTS_SCALED
  const resourceUsageCount = resources.reduce(
    (acc, resource) => {
      const inputUsageCount = Object.values(RESOURCE_PRODUCTION_INPUT_RESOURCES_SCALED).reduce((count, inputs) => {
        return count + inputs.filter((input: any) => input.resource === resource.id).length;
      }, 0);
      const buildingUsageCount = Object.values(COMPLEX_BUILDING_COSTS_SCALED).reduce((count, costs) => {
        return count + costs.filter((cost: any) => cost.resource === resource.id).length;
      }, 0);

      acc[resource.id] = inputUsageCount + buildingUsageCount;
      return acc;
    },
    {} as Record<number, number>,
  );

  // Function to sum adjusted inputs
  const sumAdjustedInputs = (resourceId: number) => {
    const adjustedInputs = getAdjustedResourceInputs(resourceId);
    return adjustedInputs.reduce((sum, input) => sum + input.adjustedAmount, 0).toFixed(2);
  };

  // adjusted demand = count * adjusted value

  const adjustedDemand = resources.reduce(
    (acc, resource) => {
      const adjustedValue: any = sumAdjustedInputs(resource.id);
      acc[resource.id] = adjustedValue * resourceUsageCount[resource.id];
      return acc;
    },
    {} as Record<number, number>,
  );

  return (
    <Table className=" w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="text-center">Image</TableHead>
          <TableHead className="text-center">Trait</TableHead>
          <TableHead className="text-center">ID</TableHead>
          <TableHead className="text-center">Ticker</TableHead>
          {/* <TableHead className="text-center">Description</TableHead> */}
          <TableHead className="text-center">Rarity</TableHead>
          <TableHead className="text-center">Tier</TableHead>
          <TableHead className="text-center">Weight (kg)</TableHead>
          <TableHead className="text-center">Resource Inputs p/s</TableHead>
          <TableHead className="text-center">Adjusted Value</TableHead>
          <TableHead className="text-center">Resource Outputs</TableHead>
          <TableHead className="text-center">Times Used</TableHead>
          <TableHead className="text-center">Resource Building Fixed Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource, index) => (
          <TableRow key={index}>
            <TableCell className="text-center">
              {getResourceImage(resource.id) ? (
                <img src={getResourceImage(resource.id)} alt={resource.trait} className="w-10 h-10 mx-auto" />
              ) : (
                "N/A"
              )}
            </TableCell>
            <TableCell className="font-medium">{resource.trait}</TableCell>
            <TableCell className="text-center">{resource.id}</TableCell>
            <TableCell className="text-center">{resource.ticker}</TableCell>
            {/* <TableCell>{getResourceDescription(resource.id)}</TableCell> */}
            <TableCell className="text-center">
              {RESOURCE_RARITY[resource.id as keyof typeof RESOURCE_RARITY]}
            </TableCell>

            <TableCell className="text-center">{getResourceTier(resource.id)}</TableCell>
            <TableCell className="text-center">{getResourceWeightKg(resource.id)}</TableCell>
            <TableCell className="rounded flex gap-2 justify-center">
              {RESOURCE_PRODUCTION_INPUT_RESOURCES_SCALED[resource.id]?.map((input, idx) => (
                <Badge className="border p-1" key={idx} style={{ borderColor: resourceColor(input.resource) }}>
                  <img src={getResourceImage(input.resource)} alt={resource.trait} className="w-6 h-6 mx-auto" /> x{" "}
                  {input.amount}
                </Badge>
              ))}
            </TableCell>
            <TableCell className="text-center">
              {sumAdjustedInputs(resource.id)} [{adjustedDemand[resource.id].toFixed(2)}]
            </TableCell>
            <TableCell className="text-center">{RESOURCE_PRODUCTION_OUTPUT_AMOUNTS[resource.id]}</TableCell>

            <TableCell className="text-center">{resourceUsageCount[resource.id]}</TableCell>
            <TableCell className="rounded flex gap-2 justify-center">
              {RESOURCE_COMPLEX_BUILDING_COSTS[resource.id]?.map((input, idx) => (
                <Badge className={`border p-1`} key={idx} style={{ borderColor: resourceColor(input.resource) }}>
                  <img src={getResourceImage(input.resource)} alt={resource.trait} className="w-6 h-6 mx-auto" /> x{" "}
                  {input.amount}
                </Badge>
              ))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
