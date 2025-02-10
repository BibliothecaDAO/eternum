import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { Biome, CombatSimulator, resources, ResourcesIds, TroopType } from "@bibliothecadao/eternum";
import React, { useState } from "react";

interface SelectBiomeProps {
  onSelect: (biome: Biome | null) => void;
  className?: string;
  defaultValue?: Biome;
}

const TROOP_RESOURCES = [
  { type: TroopType.KNIGHT, resourceId: ResourcesIds.Knight },
  { type: TroopType.CROSSBOWMAN, resourceId: ResourcesIds.Crossbowman },
  { type: TroopType.PALADIN, resourceId: ResourcesIds.Paladin },
];

export const SelectBiome: React.FC<SelectBiomeProps> = ({ onSelect, className, defaultValue = Biome.GRASSLAND }) => {
  const [selectedBiome, setSelectedBiome] = useState<string>(defaultValue?.toString() || "");

  const formatBiomeName = (biome: string) => {
    return biome
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const formatBonus = (bonus: number) => {
    const percentage = ((bonus - 1) * 100).toFixed(0);
    if (bonus > 1) return `+${percentage}%`;
    if (bonus < 1) return `${percentage}%`;
    return "0%";
  };

  // Call onSelect with default value on mount
  React.useEffect(() => {
    if (defaultValue !== undefined) {
      onSelect(defaultValue);
    }
  }, []);

  return (
    <Select
      value={selectedBiome}
      onValueChange={(value) => {
        setSelectedBiome(value);
        onSelect(value as Biome);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select biome" />
      </SelectTrigger>
      <SelectContent>
        {Object.values(Biome).map((biome) => (
          <SelectItem key={biome} value={biome}>
            <div className="flex flex-col py-0.5">
              <span className="font-medium text-base">{formatBiomeName(biome)}</span>
              <div className="flex gap-3 mt-0.5 opacity-80">
                {TROOP_RESOURCES.map(({ type, resourceId }) => {
                  const bonus = CombatSimulator.getBiomeBonus(type, biome);
                  return (
                    <div key={type} className="flex items-center gap-0.5">
                      <ResourceIcon resource={resources.find((r) => r.id === resourceId)?.trait || ""} size="xs" />
                      <span
                        className={
                          bonus > 1
                            ? "text-green-600 text-xs"
                            : bonus < 1
                              ? "text-red-600 text-xs"
                              : "text-gray-400 text-xs"
                        }
                      >
                        {formatBonus(bonus)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
