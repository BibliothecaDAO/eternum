import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RESOURCE_BUILDING_COSTS,
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS,
  RESOURCE_TIERS,
  ResourceRarity,
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
    return WEIGHTS_GRAM[id] || 0;
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
    const multiplier = ResourceRarity[resourceId] || 1; // Default multiplier is 1

    return (
      RESOURCE_INPUTS_SCALED[resourceId]?.map((input) => ({
        ...input,
        adjustedAmount: input.amount * multiplier,
      })) || []
    );
  };

  // Function to sum adjusted inputs
  const sumAdjustedInputs = (resourceId: number) => {
    const adjustedInputs = getAdjustedResourceInputs(resourceId);
    return adjustedInputs.reduce((sum, input) => sum + input.adjustedAmount, 0).toFixed(2);
  };

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
            <TableCell className="text-center">{ResourceRarity[resource.id as keyof typeof ResourceRarity]}</TableCell>

            <TableCell className="text-center">{getResourceTier(resource.id)}</TableCell>
            <TableCell className="text-center">{getResourceWeight(resource.id)}</TableCell>
            <TableCell className="rounded flex gap-2 justify-center">
              {RESOURCE_INPUTS_SCALED[resource.id]?.map((input, idx) => (
                <Badge className="border p-1" key={idx} style={{ borderColor: resourceColor(input.resource) }}>
                  <img src={getResourceImage(input.resource)} alt={resource.trait} className="w-6 h-6 mx-auto" /> x{" "}
                  {input.amount}
                </Badge>
              ))}
            </TableCell>
            <TableCell className="text-center">{sumAdjustedInputs(resource.id)}</TableCell>
            <TableCell className="text-center">{RESOURCE_OUTPUTS[resource.id]}</TableCell>
            <TableCell className="rounded flex gap-2 justify-center">
              {RESOURCE_BUILDING_COSTS[resource.id]?.map((input, idx) => (
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
