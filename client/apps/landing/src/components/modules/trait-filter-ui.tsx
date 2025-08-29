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

const FILTERABLE_TRAITS = ["Resource", "Epoch", "Epoch Item", "Rarity", "Type"] as const;

const getTraitPlaceholder = (traitType: string): string => {
  const placeholders: Record<string, string> = {
    Resource: "Filter by Resource",
    Epoch: "Filter by Epoch",
    "Epoch Item": "Filter by Epoch Item",
    Rarity: "Filter by Rarity",
    Type: "Filter by Type",
  };
  return placeholders[traitType] || `Filter by ${traitType}`;
};

const sortResourceValues = (values: string[]): string[] => {
  return [...values].sort((a, b) => {
    const normalizeResource = (resource: string) => resource.replace(/\s/g, "");
    const aId = ResourcesIds[normalizeResource(a) as keyof typeof ResourcesIds];
    const bId = ResourcesIds[normalizeResource(b) as keyof typeof ResourcesIds];
    const aRarity = (aId !== undefined ? RESOURCE_RARITY[aId] : undefined) || Infinity;
    const bRarity = (bId !== undefined ? RESOURCE_RARITY[bId] : undefined) || Infinity;
    return aRarity - bRarity;
  });
};

const FilterBadge = ({ traitType, value, onRemove }: { traitType: string; value: string; onRemove: () => void }) => {
  if (traitType === "Wonder") {
    return (
      <Badge key={`${traitType}-filter`} variant="default">
        Has Wonder
        <button
          onClick={onRemove}
          className="ml-1.5 p-0.5 rounded-full hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    );
  }

  return (
    <Badge key={`${traitType}-${value}`} variant="default">
      {traitType === "Resource" && <ResourceIcon resource={value} size="md" className="mr-1 inline-block" />}
      {value}
      <button
        onClick={onRemove}
        className="ml-1.5 p-0.5 rounded-full hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
};

const WonderFilter = ({ isChecked, onToggle }: { isChecked: boolean; onToggle: (checked: boolean) => void }) => (
  <div className="flex items-center h-9 px-3 rounded-md border border-input bg-background space-x-2 pb-0">
    <Checkbox id="wonder-filter" checked={isChecked} onCheckedChange={onToggle} />
    <Label
      htmlFor="wonder-filter"
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
    >
      Filter by Wonder
    </Label>
  </div>
);

const TraitSelect = ({
  traitType,
  values,
  selectedValue,
  onValueChange,
}: {
  traitType: string;
  values: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}) => {
  const sortedValues = traitType === "Resource" ? sortResourceValues(values) : values;
  const placeholder = getTraitPlaceholder(traitType);

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={selectedValue} onValueChange={onValueChange}>
        <SelectTrigger id={`filter-${traitType}`} className="h-9">
          <SelectValue placeholder={placeholder}>{selectedValue ? placeholder : undefined}</SelectValue>
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
};

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
    return null;
  }

  const handleWonderToggle = (checked: boolean) => {
    if (checked) {
      handleFilterChange("Wonder", "__ALL_WONDERS__");
    } else {
      clearFilter("Wonder");
    }
  };

  const renderFilterBadges = () => {
    return Object.entries(selectedFilters).map(([traitType, values]) =>
      values.map((value) => (
        <FilterBadge
          key={`${traitType}-${value}`}
          traitType={traitType}
          value={value}
          onRemove={() => (traitType === "Wonder" ? clearFilter(traitType) : handleFilterChange(traitType, value))}
        />
      )),
    );
  };

  const renderTraitSelects = () => {
    return Object.entries(allTraits)
      .filter(([traitType]) => FILTERABLE_TRAITS.includes(traitType as any))
      .map(([traitType, values]) => (
        <TraitSelect
          key={traitType}
          traitType={traitType}
          values={values}
          selectedValue={selectedFilters[traitType]?.[0] || ""}
          onValueChange={(value) => handleFilterChange(traitType, value)}
        />
      ));
  };

  return (
    <>
      {hasActiveFilters && (
        <div className="border-r pr-4 border-border/50 flex flex-wrap gap-0.5 sm:gap-2 items-center">
          {renderFilterBadges()}
        </div>
      )}

      <div className="flex justify-center items-end gap-4">
        {allTraits["Wonder"] && <WonderFilter isChecked={!!selectedFilters["Wonder"]} onToggle={handleWonderToggle} />}
        {renderTraitSelects()}
      </div>
    </>
  );
}
