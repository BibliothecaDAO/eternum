import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESOURCE_RARITY, ResourcesIds } from "@bibliothecadao/types";
import { X } from "lucide-react";
import { ResourceIcon } from "../ui/elements/resource-icon";

interface TraitFilterUIProps {
  allTraits: Record<string, string[]>;
  selectedFilters: Record<string, string[]>;
  handleFilterChange: (traitType: string, value: string) => void;
  clearFilter: (traitType: string) => void;
  clearAllFilters: () => void;
}

export function TraitFilterUI({
  allTraits,
  selectedFilters,
  handleFilterChange,
  clearFilter,
  clearAllFilters,
}: TraitFilterUIProps) {
  const hasActiveFilters = Object.keys(selectedFilters).length > 0;
  const hasTraits = Object.keys(allTraits).length > 0;

  if (!hasTraits) {
    return null; // Don't render anything if there are no traits to filter by
  }

  return (
    <div className=" p-4 border-y">
      {/* <div className="flex justify-between items-center">
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-auto py-1 px-2">
            Clear All Filters
            <X className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div> */}
      <div className="flex justify-center items-end gap-4">
        {/* Render Checkbox for Wonder trait */}
        {allTraits["Wonder"] && (
          <div className="flex items-center h-9 px-3 rounded-md border border-input bg-background space-x-2 pb-0">
            <Checkbox
              id="wonder-filter"
              checked={!!selectedFilters["Wonder"]}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleFilterChange("Wonder", "__ALL_WONDERS__"); // Use special value
                } else {
                  clearFilter("Wonder");
                }
              }}
            />
            <Label
              htmlFor="wonder-filter"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Filter by Wonder
            </Label>
          </div>
        )}

        {/* Render Select dropdowns for other traits (e.g., Resource) */}
        {Object.entries(allTraits)
          .filter(([traitType]) => traitType === "Resource") // Only include Resource
          .map(([traitType, values]) => {
            // Sort resources by their ID (rarity)
            const sortedValues =
              traitType === "Resource"
                ? [...values].sort((a, b) => {
                    const idA = ResourcesIds[a as keyof typeof ResourcesIds];
                    const idB = ResourcesIds[b as keyof typeof ResourcesIds];
                    const rarityA = (idA !== undefined ? RESOURCE_RARITY[idA] : undefined) || Infinity;
                    const rarityB = (idB !== undefined ? RESOURCE_RARITY[idB] : undefined) || Infinity;
                    return rarityA - rarityB;
                  })
                : values;

            return (
              <div key={traitType} className="flex flex-col gap-1.5">
                <Select
                  value={selectedFilters[traitType]?.[0] || ""} // Assuming single select
                  onValueChange={(value) => handleFilterChange(traitType, value)}
                >
                  <SelectTrigger id={`filter-${traitType}`} className="h-9">
                    <SelectValue placeholder="Filter by Resource">
                      {/* Always display 'Filter by Resource' if a resource is selected */}
                      {selectedFilters["Resource"]?.[0] ? "Filter by Resource" : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortedValues.map((value) => (
                      <SelectItem key={value} value={value} className="flex items-center gap-2 text-lg">
                        <div className="flex items-center gap-2">
                          {traitType === "Resource" && <ResourceIcon resource={value} size="md" />}
                          <span className="text-xs">{value}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
      </div>
      {/* Display Active Filters */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2 items-center">
          {Object.entries(selectedFilters).map(([traitType, values]) =>
            values.map((value) => {
              // Handle Wonder badge display
              if (traitType === "Wonder") {
                return (
                  <Badge key={`${traitType}-filter`} variant="default" className="">
                    Has Wonder
                    <button
                      onClick={() => clearFilter(traitType)}
                      className="ml-1.5 p-0.5 rounded-full hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              }
              // Handle other trait badges
              return (
                <Badge key={`${traitType}-${value}`} variant="default" className="">
                  {traitType.replace(/_/g, " ")}:{" "}
                  {traitType === "Resource" && (
                    <ResourceIcon resource={value} size="md" className="mr-1 inline-block" />
                  )}
                  {value}
                  <button
                    onClick={() => handleFilterChange(traitType, value)} // Use handleFilterChange to remove specific value
                    className="ml-1.5 p-0.5 rounded-full hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
