import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COSMETIC_NAMES } from "@/utils/cosmetics";
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

const FILTERABLE_TRAITS = [
  "Resource",
  "Epoch",
  "Epoch Item",
  "Rarity",
  "Type",
  "Beast",
  "Tier",
  "Level",
  "Power",
  "Rank",
  "Shiny",
  "Animated",
  "Genesis",
] as const;

const getTraitPlaceholder = (traitType: string): string => {
  const placeholders: Record<string, string> = {
    Resource: "Filter by Resource",
    Epoch: "Filter by Epoch",
    "Epoch Item": "Filter by Name",
    Rarity: "Filter by Rarity",
    Type: "Filter by Type",
    Beast: "Filter by Beast",
    Tier: "Filter by Tier",
    Level: "Filter by Level",
    Power: "Filter by Power",
    Rank: "Filter by Rank",
    Shiny: "Filter by Shiny",
    Animated: "Filter by Animated",
    Genesis: "Filter by Genesis",
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

const sortRarityValues = (values: string[]): string[] => {
  const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  return [...values].sort((a, b) => {
    const aIndex = rarityOrder.indexOf(a);
    const bIndex = rarityOrder.indexOf(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
};

const sortNumericValues = (values: string[]): string[] => {
  return [...values].sort((a, b) => {
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    if (isNaN(aNum) && isNaN(bNum)) return a.localeCompare(b);
    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return aNum - bNum;
  });
};

const getItemNameFromId = (id: string): string => {
  const cosmetic = COSMETIC_NAMES.find((c) => c.id === id);
  return cosmetic ? cosmetic.name : id;
};

const formatDisplayValue = (traitType: string, value: string): string => {
  if (["Shiny", "Animated", "Genesis"].includes(traitType)) {
    return value === "1" ? "true" : "false";
  }
  return traitType === "Epoch Item" ? getItemNameFromId(value) : value;
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

  const displayValue = formatDisplayValue(traitType, value);

  return (
    <Badge key={`${traitType}-${value}`} variant="default">
      {traitType === "Resource" && <ResourceIcon resource={value} size="md" className="mr-1 inline-block" />}
      <span className="font-medium">{traitType}:</span> {displayValue}
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
  <div className="flex items-center h-9 px-3 rounded-md border border-input bg-background space-x-2 pb-0 flex-shrink-0">
    <Checkbox id="wonder-filter" checked={isChecked} onCheckedChange={onToggle} />
    <Label
      htmlFor="wonder-filter"
      className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap"
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
  let sortedValues = values;
  if (traitType === "Resource") {
    sortedValues = sortResourceValues(values);
  } else if (traitType === "Rarity") {
    sortedValues = sortRarityValues(values);
  } else if (["Tier", "Level", "Power", "Rank", "Shiny", "Animated", "Genesis"].includes(traitType)) {
    sortedValues = sortNumericValues(values);
  }

  const placeholder = getTraitPlaceholder(traitType);

  return (
    <div className="flex flex-col gap-1.5 min-w-0 flex-shrink-0">
      <Select value={selectedValue} onValueChange={onValueChange}>
        <SelectTrigger id={`filter-${traitType}`} className="h-9 min-w-[120px] max-w-[200px] text-xs sm:text-sm">
          <SelectValue placeholder={placeholder}>{selectedValue ? placeholder : undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sortedValues.map((value) => (
            <SelectItem key={value} value={value} className="flex items-center gap-2 text-lg">
              <div className="flex items-center gap-2">
                {traitType === "Resource" && <ResourceIcon resource={value} size="md" />}
                <span className="text-xs">{formatDisplayValue(traitType, value)}</span>
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
  clearAllFilters: _clearAllFilters,
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
      .filter(([traitType]) => FILTERABLE_TRAITS.includes(traitType as (typeof FILTERABLE_TRAITS)[number]))
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

      <div className="flex flex-col sm:flex-row sm:justify-center items-center sm:items-end gap-2 sm:gap-4 max-w-full">
        <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2 sm:gap-4 max-w-full overflow-x-auto">
          {allTraits["Wonder"] && (
            <WonderFilter isChecked={!!selectedFilters["Wonder"]} onToggle={handleWonderToggle} />
          )}
          <div className="flex flex-wrap gap-2 sm:gap-4 max-w-full">{renderTraitSelects()}</div>
        </div>
      </div>
    </>
  );
}
