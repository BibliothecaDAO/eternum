import { ResourcesIds } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useEffect, useMemo, useState } from "react";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatBiomeBonus } from "@/ui/features/military";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, TroopType } from "@bibliothecadao/types";

enum BiomeFilenames {
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

// Get the appropriate biome image filename
const getBiomeImage = (biome: BiomeType) => {
  const biomeKey = biome as keyof typeof BiomeFilenames;
  return `/images/biomes/${BiomeFilenames[biomeKey]}`;
};

const formatBiomeLabel = (biome: BiomeType | string) => {
  const label = biome.toString();
  return label
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
};

// Troop type configuration with resource names for ResourceIcon
const troopConfig = {
  [TroopType.Knight]: {
    resourceId: ResourcesIds.Knight,
    label: "Knights",
  },
  [TroopType.Crossbowman]: {
    resourceId: ResourcesIds.Crossbowman,
    label: "Crossbowmen",
  },
  [TroopType.Paladin]: {
    resourceId: ResourcesIds.Paladin,
    label: "Paladins",
  },
};

// Get bonus styling based on value
const getBonusStyles = (bonus: number) => {
  if (bonus > 1) {
    return {
      containerClass: "border-hud-good",
      textClass: "text-hud-good",
    };
  }
  if (bonus < 1) {
    return {
      containerClass: "border-hud-bad",
      textClass: "text-hud-bad",
    };
  }
  return {
    containerClass: "border-hud-line",
    textClass: "text-hud-ink",
  };
};

interface BiomeInfoPanelProps {
  biome: BiomeType;
  collapsed?: boolean;
}

export const BiomeInfoPanel = ({ biome, collapsed = false }: BiomeInfoPanelProps) => {
  const troopTypes = useMemo(() => [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin], []);
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  useEffect(() => {
    setIsExpanded(!collapsed);
  }, [collapsed, biome]);

  const troopBonuses = useMemo(
    () =>
      troopTypes.map((troopType) => {
        const config = troopConfig[troopType];
        const bonus = configManager.getBiomeCombatBonus(troopType, biome);
        const styles = getBonusStyles(bonus);
        return {
          troopType,
          config,
          bonus,
          styles,
          summaryTextClass: bonus > 1 ? "text-hud-good" : bonus < 1 ? "text-hud-bad" : "text-hud-ink",
        };
      }),
    [biome, troopTypes],
  );

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  if (!configManager.hasBiomeCombatEffects()) return null;

  return (
    <div className="rounded-xl border border-hud-line bg-hud-surface">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 rounded-t-xl px-3 py-1.5 text-left transition-colors hover:bg-hud-hover"
      >
        <div className="flex items-center gap-2">
          <span className="text-hud-label text-hud-muted">Biome</span>
          <span className="text-hud-strong text-hud-ink">{formatBiomeLabel(biome)}</span>
        </div>
        <div className="flex items-center gap-2">
          {troopBonuses.map(({ troopType, config, bonus, summaryTextClass }) => (
            <div key={troopType} className="flex items-center gap-1 rounded-md bg-hud-well px-1.5 py-0.5">
              <ResourceIcon resource={config.resourceId} size="xs" withTooltip={false} />
              <span className={`text-hud-label leading-none ${summaryTextClass}`}>{formatBiomeBonus(bonus)}</span>
            </div>
          ))}
          <SemanticIcon
            name="chevron-down"
            className={`h-4 w-4 text-hud-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div
          className="relative overflow-hidden rounded-b-xl border-t border-hud-divider bg-cover bg-center p-3"
          style={{ backgroundImage: `url(${getBiomeImage(biome)})` }}
        >
          {/* The biome's painting shows faintly through the panel's own ground, so its words read on it. */}
          <div className="pointer-events-none absolute inset-0 bg-hud-surface opacity-90" />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-hud-title text-hud-ink">{formatBiomeLabel(biome)}</h2>
              <span data-tip="Terrain affects combat effectiveness" className="group">
                <SemanticIcon
                  name="info"
                  className="h-4 w-4 text-hud-muted transition-colors group-hover:text-hud-ink"
                />
              </span>
            </div>
            <p className="text-hud-body text-hud-muted">Combat effectiveness varies by troop type</p>

            <div className="flex flex-row gap-2">
              {troopBonuses.map(({ troopType, config, bonus, styles }) => (
                <div
                  key={troopType}
                  className={`relative flex-1 rounded-lg border-2 px-2 py-2 ${styles.containerClass}`}
                  role="tooltip"
                  aria-label={`${config.label}: ${formatBiomeBonus(bonus)} combat effectiveness`}
                >
                  <div className="mb-1.5 flex justify-center">
                    <ResourceIcon resource={config.resourceId} size="lg" withTooltip={false} className="opacity-90" />
                  </div>
                  <div className={`text-hud-strong text-center ${styles.textClass}`}>{formatBiomeBonus(bonus)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
