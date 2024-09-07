import { ResourcesIds } from "@bibliothecadao/eternum";
import React from "react";
import { ResourceIcon } from "./ResourceIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";

interface SelectResourceProps {
  onSelect: (resourceId: number | null) => void;
  className?: string;
}

export const SelectResource: React.FC<SelectResourceProps> = ({ onSelect, className }) => {
  const resourceIds: number[] = [
    ResourcesIds.Wood,
    ResourcesIds.Stone,
    ResourcesIds.Coal,
    ResourcesIds.Copper,
    ResourcesIds.Obsidian,
    ResourcesIds.Silver,
    ResourcesIds.Ironwood,
    ResourcesIds.ColdIron,
    ResourcesIds.Gold,
    ResourcesIds.Hartwood,
    ResourcesIds.Diamonds,
    ResourcesIds.Sapphire,
    ResourcesIds.Ruby,
    ResourcesIds.DeepCrystal,
  ];

  return (
    <Select onValueChange={(value) => onSelect(value ? parseInt(value) : null)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select a resource" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="clear">
          <div className="flex items-center">
            <span>Clear selection</span>
          </div>
        </SelectItem>
        {resourceIds.map((resourceId) => (
          <SelectItem key={resourceId} value={resourceId.toString()}>
            <div className="flex items-center">
              <ResourceIcon resource={ResourcesIds[resourceId]} size="md" />
              <span className="ml-2">{ResourcesIds[resourceId]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
