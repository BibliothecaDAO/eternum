import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { resources, ResourcesIds, TroopType } from "@bibliothecadao/eternum";
import React, { useState } from "react";

interface SelectTroopProps {
  onSelect: (troopType: TroopType | null) => void;
  className?: string;
  defaultValue?: TroopType;
}

const TROOP_RESOURCES = [
  { type: TroopType.KNIGHT, resourceId: ResourcesIds.Knight },
  { type: TroopType.CROSSBOWMAN, resourceId: ResourcesIds.Crossbowman },
  { type: TroopType.PALADIN, resourceId: ResourcesIds.Paladin },
];

const formatTroopName = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

export const SelectTroop: React.FC<SelectTroopProps> = ({ onSelect, className, defaultValue = TroopType.KNIGHT }) => {
  const [selectedTroop, setSelectedTroop] = useState<string>(defaultValue?.toString() || "");

  // Call onSelect with default value on mount
  React.useEffect(() => {
    if (defaultValue !== undefined) {
      onSelect(defaultValue);
    }
  }, []);

  return (
    <Select
      value={selectedTroop}
      onValueChange={(value) => {
        setSelectedTroop(value);
        onSelect(value as TroopType);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select troop">
          {selectedTroop && (
            <div className="flex items-center">
              <ResourceIcon
                resource={
                  resources.find((r) => r.id === TROOP_RESOURCES.find((t) => t.type === selectedTroop)?.resourceId)
                    ?.trait || ""
                }
                size="md"
              />
              <span className="ml-2">{formatTroopName(selectedTroop)}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TROOP_RESOURCES.map(({ type, resourceId }) => (
          <SelectItem key={type} value={type}>
            <div className="flex items-center">
              <ResourceIcon resource={resources.find((r) => r.id === resourceId)?.trait || ""} size="md" />
              <span className="ml-2">{formatTroopName(type)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
