import { useMemo } from "react";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatBiomeBonus } from "@/ui/features/military";
import { EntityDetailLayoutProvider, EntityDetailSection } from "@/ui/features/world/components/entities/layout";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, TroopType } from "@bibliothecadao/types";

const unoccupiedTileTroopTypes: TroopType[] = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin];

const unoccupiedTileTroopConfig: Record<
  TroopType,
  {
    resourceName: string;
    label: string;
  }
> = {
  [TroopType.Knight]: {
    resourceName: "Knight",
    label: "Knights",
  },
  [TroopType.Crossbowman]: {
    resourceName: "Crossbowman",
    label: "Crossbowmen",
  },
  [TroopType.Paladin]: {
    resourceName: "Paladin",
    label: "Paladins",
  },
};

enum BiomeQuadrantFilenames {
  Bare = "bare.png",
  Beach = "beach.png",
  TemperateDeciduousForest = "decidiousforest.png",
  DeepOcean = "deepocean.png",
  Grassland = "grassland.png",
  Ocean = "ocean.png",
  Outline = "outline.png",
  Scorched = "scorched.png",
  Tundra = "tundra.png",
  TemperateDesert = "temperatedesert.png",
  Shrubland = "shrublands.png",
  Snow = "snow.png",
  Taiga = "taiga.png",
  TemperateRainForest = "temperaterainforest.png",
  SubtropicalDesert = "subtropicaldesert.png",
  TropicalRainForest = "rainforest.png",
  TropicalSeasonalForest = "tropicalseasonalforest.png",
  Empty = "empty.png",
}

const getQuadrantBiomeImage = (biome: BiomeType) => {
  const biomeKey = biome as keyof typeof BiomeQuadrantFilenames;
  return `/images/biomes/${BiomeQuadrantFilenames[biomeKey]}`;
};

const formatQuadrantBiomeLabel = (biome: BiomeType | string) => {
  const label = biome.toString();
  return label
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
};

const getQuadrantBonusStyles = (bonus: number) => {
  if (bonus > 1) {
    return {
      containerClass: "border-green-500/60 bg-green-900/30 shadow-green-500/20",
      textClass: "text-green-300",
    };
  }
  if (bonus < 1) {
    return {
      containerClass: "border-red-500/60 bg-red-900/30 shadow-red-500/20",
      textClass: "text-red-300",
    };
  }
  return {
    containerClass: "border-gold/30 bg-brown-800/60 shadow-gold/10",
    textClass: "text-gold/90",
  };
};

const BiomeQuadrant = ({ biome }: { biome: BiomeType }) => {
  const troopBonuses = useMemo(
    () =>
      unoccupiedTileTroopTypes.map((troopType) => {
        const config = unoccupiedTileTroopConfig[troopType];
        const bonus = configManager.getBiomeCombatBonus(troopType, biome);
        const styles = getQuadrantBonusStyles(bonus);
        return {
          troopType,
          config,
          bonus,
          styles,
          summaryTextClass: bonus > 1 ? "text-green-300" : bonus < 1 ? "text-red-300" : "text-gold/80",
        };
      }),
    [biome],
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Biome</span>
          <span className="text-sm font-semibold text-gold">{formatQuadrantBiomeLabel(biome)}</span>
        </div>
        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          {troopBonuses.map(({ troopType, config, bonus, summaryTextClass }) => (
            <div key={troopType} className="flex items-center gap-1 rounded-md bg-dark/60 px-1.5 py-0.5">
              <ResourceIcon resource={config.resourceName} size="xs" withTooltip={false} />
              <span className={`text-[11px] font-semibold leading-none ${summaryTextClass}`}>
                {formatBiomeBonus(bonus)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const UnoccupiedTileQuadrants = ({ biome }: { biome: BiomeType }) => {
  return (
    <EntityDetailLayoutProvider variant="hud" density="compact" minimizeCopy={false}>
      <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 sm:grid-rows-2 sm:auto-rows-fr">
        <EntityDetailSection className="flex h-full flex-col overflow-hidden" tone="highlight">
          <BiomeQuadrant biome={biome} />
        </EntityDetailSection>
        <EntityDetailSection className="min-h-0" />
        <EntityDetailSection className="min-h-0" />
        <EntityDetailSection className="min-h-0" />
      </div>
    </EntityDetailLayoutProvider>
  );
};
