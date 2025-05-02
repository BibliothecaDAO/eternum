import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    <div className=" p-4 border rounded-lg bg-muted/10">
      {/* <div className="flex justify-between items-center">
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-auto py-1 px-2">
            Clear All Filters
            <X className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div> */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.entries(allTraits)
          .filter(([traitType]) => traitType === "Resource")
          .map(([traitType, values]) => (
            <div key={traitType} className="flex flex-col gap-1.5">
              <Label htmlFor={`filter-${traitType}`} className="text-sm uppercase">
                {traitType.replace(/_/g, " ")}
              </Label>
              <Select
                value={selectedFilters[traitType]?.[0] || ""} // Assuming single select
                onValueChange={(value) => handleFilterChange(traitType, value)}
              >
                <SelectTrigger id={`filter-${traitType}`} className="h-9">
                  <SelectValue placeholder={`Any ${traitType.replace(/_/g, " ")}`} />
                </SelectTrigger>
                <SelectContent>
                  {values.map((value) => (
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
          ))}
      </div>
      {/* Display Active Filters */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2 items-center">
          {Object.entries(selectedFilters).map(([traitType, values]) =>
            values.map((value) => (
              <Badge key={`${traitType}-${value}`} variant="default" className="">
                {traitType.replace(/_/g, " ")}:{" "}
                {traitType === "Resource" && <ResourceIcon resource={value} size="md" className="mr-1 inline-block" />}
                {value}
                <button
                  onClick={() => clearFilter(traitType)}
                  className="ml-1.5 p-0.5 rounded-full hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )),
          )}
        </div>
      )}
    </div>
  );
}
