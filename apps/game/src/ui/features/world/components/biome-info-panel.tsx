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
      containerClass: "border-green-500/60 bg-green-900/30 shadow-green-500/20",
      textClass: "text-hud-good",
    };
  }
  if (bonus < 1) {
    return {
      containerClass: "border-red-500/60 bg-red-900/30 shadow-red-500/20",
      textClass: "text-hud-bad",
    };
  }
  return {
    containerClass: "border-hud-line bg-brown-800/60 shadow-gold/10",
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
    <div className="rounded-xl border border-hud-line bg-dark/70 backdrop-blur-sm shadow-md">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 rounded-t-xl px-3 py-1.5 text-left transition-colors hover:bg-hud-hover"
      >
        <div className="flex items-center gap-2">
          <span className="text-hud-label uppercase tracking-[0.3em] text-hud-muted">Biome</span>
          <span className="text-hud-strong text-hud-ink">{formatBiomeLabel(biome)}</span>
        </div>
        <div className="flex items-center gap-2">
          {troopBonuses.map(({ troopType, config, bonus, summaryTextClass }) => (
            <div key={troopType} className="flex items-center gap-1 rounded-md bg-dark/60 px-1.5 py-0.5">
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
          className="relative overflow-hidden rounded-b-xl border-t border-hud-divider p-3 shadow-inner"
          style={{
            backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.85), rgba(20, 16, 13, 0.85)), url(${getBiomeImage(biome)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-b-xl border-2 border-transparent bg-gradient-to-br from-gold/5 to-transparent" />

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
                  className={`group relative flex-1 rounded-lg border-2 px-2 py-2 shadow-lg transition-all duration-200 hover:shadow-xl ${styles.containerClass}`}
                  role="tooltip"
                  aria-label={`${config.label}: ${formatBiomeBonus(bonus)} combat effectiveness`}
                >
                  <div className="mb-1.5 flex justify-center">
                    <ResourceIcon resource={config.resourceId} size="lg" withTooltip={false} className="opacity-90" />
                  </div>
                  <div className={`text-hud-strong text-center ${styles.textClass}`}>{formatBiomeBonus(bonus)}</div>
                  {bonus !== 1 && (
                    <div
                      className={`pointer-events-none absolute inset-0 rounded-lg opacity-20 ${
                        bonus > 1 ? "bg-green-400/20" : "bg-red-400/20"
                      } animate-pulse`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
