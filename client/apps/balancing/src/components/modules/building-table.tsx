import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    BUILDING_CAPACITY,
    BUILDING_POPULATION,
    BUILDING_RESOURCE_PRODUCED,
    BuildingType,
    COMPLEX_BUILDING_COSTS,
    COMPLEX_BUILDING_COSTS_SCALED,
    RESOURCE_RARITY,
    ResourcesIds,
    resources,
} from "@bibliothecadao/eternum";
import { Badge } from "../ui/badge";

export const BuildingTable = () => {
  // Assuming BuildingType is an enum, we extract its keys for iteration
  const buildingTypes = Object.keys(BuildingType).filter((key) => isNaN(Number(key))) as Array<
    keyof typeof BuildingType
  >;

  const resourceName = (id: number) => {
    return resources.find((resource) => resource.id === id)?.trait;
  };

  const resourceColor = (id: number) => {
    return resources.find((resource) => resource.id === id)?.colour;
  };

  const getAdjustedResourceInputs = (buildingId: number) => {
    // const multiplier = HYPERSTRUCTURE_RESOURCE_MULTIPLIERS[buildingId] || 1; // Default multiplier is 1

    return (
      COMPLEX_BUILDING_COSTS_SCALED[buildingId]?.map((input) => ({
        ...input,
        adjustedAmount: input.amount * RESOURCE_RARITY[input.resource],
      })) || []
    );
  };

  // Function to sum adjusted inputs
  const sumAdjustedInputs = (buildingId: number) => {
    const adjustedInputs = getAdjustedResourceInputs(buildingId);
    return adjustedInputs.reduce((sum, input) => sum + input.adjustedAmount, 0).toFixed(2);
  };

  const getResourceImage = (id: number) => {
    return resources.find((resource) => resource.id === id)?.img || "";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Building</TableHead>
          {/* <TableHead>Description</TableHead> */}
          <TableHead>Capacity</TableHead>
          <TableHead>Population</TableHead>
          <TableHead>Resource Produced</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>Cost Scaled</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {buildingTypes.map((typeKey) => {
          const type = BuildingType[typeKey];
          const resourceProduced = BUILDING_RESOURCE_PRODUCED[type]
            ? ResourcesIds[BUILDING_RESOURCE_PRODUCED[type] as unknown as keyof typeof ResourcesIds]
            : "None";

          return (
            <TableRow key={type}>
              <TableCell>{typeKey}</TableCell>
              {/* <TableCell>{BUILDING_INFORMATION[type]}</TableCell> */}
              <TableCell>{BUILDING_CAPACITY[type]}</TableCell>
              <TableCell>{BUILDING_POPULATION[type]}</TableCell>
              <TableCell>{resourceProduced}</TableCell>
              <TableCell className="rounded flex gap-2 justify-center">
                {COMPLEX_BUILDING_COSTS[type]?.map((input, idx) => (
                  <Badge className={`border p-1`} key={idx} style={{ borderColor: resourceColor(input.resource) }}>
                    <img src={getResourceImage(input.resource)} className="w-6 h-6 mx-auto" /> x {input.amount}
                  </Badge>
                ))}
              </TableCell>
              <TableCell>{sumAdjustedInputs(type)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
