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
        <SelectValue placeholder="Select biome">
          {selectedBiome && (
            <div className="flex items-center justify-start w-full">
              <span className="font-medium w-[200px] flex justify-start">{formatBiomeName(selectedBiome)}</span>
              <div className="flex gap-8">
                {TROOP_RESOURCES.map(({ type, resourceId }) => {
                  const bonus = CombatSimulator.getBiomeBonus(type, selectedBiome as Biome);
                  return (
                    <div key={type} className="flex items-center gap-2 w-16 justify-end">
                      <ResourceIcon resource={resources.find((r) => r.id === resourceId)?.trait || ""} size="sm" />
                      <span
                        className={
                          bonus > 1
                            ? "text-order-brilliance text-xs"
                            : bonus < 1
                              ? "text-order-giants text-xs"
                              : "text-gold/50 text-xs"
                        }
                      >
                        {formatBonus(bonus)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.values(Biome).map((biome) => (
          <SelectItem key={biome} value={biome} className="py-3">
            <div className="flex items-center justify-between w-full">
              <span className="font-medium w-[200px] flex justify-start">{formatBiomeName(biome)}</span>
              <div className="flex gap-8 ml-10">
                {TROOP_RESOURCES.map(({ type, resourceId }) => {
                  const bonus = CombatSimulator.getBiomeBonus(type, biome);
                  return (
                    <div key={type} className="flex items-center gap-2 w-16 justify-end">
                      <ResourceIcon resource={resources.find((r) => r.id === resourceId)?.trait || ""} size="sm" />
                      <span
                        className={
                          bonus > 1
                            ? "text-order-brilliance text-sm font-medium"
                            : bonus < 1
                              ? "text-order-giants text-sm font-medium"
                              : "text-gold/50 text-sm"
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
