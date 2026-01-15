import { Card } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, TroopType } from "@bibliothecadao/types";
import { Info } from "lucide-react";

interface MobileBiomeInfoPanelProps {
  biome: BiomeType;
}

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

const getBiomeImage = (biome: BiomeType) => {
  const biomeKey = biome as keyof typeof BiomeFilenames;
  return `/images/biomes/${BiomeFilenames[biomeKey]}`;
};

const troopConfig = {
  [TroopType.Knight]: {
    resourceId: 26,
    label: "Knights",
  },
  [TroopType.Crossbowman]: {
    resourceId: 29,
    label: "Crossbowmen",
  },
  [TroopType.Paladin]: {
    resourceId: 32,
    label: "Paladins",
  },
};

const formatBiomeBonus = (bonus: number): string => {
  if (bonus === 1) return "1.0x";
  return `${bonus.toFixed(1)}x`;
};

const getBonusStyles = (bonus: number) => {
  if (bonus > 1) {
    return {
      containerClass: "border-green-500/60 bg-green-900/20",
      textClass: "text-green-400",
    };
  } else if (bonus < 1) {
    return {
      containerClass: "border-red-500/60 bg-red-900/20",
      textClass: "text-red-400",
    };
  }
  return {
    containerClass: "border-border",
    textClass: "text-muted-foreground",
  };
};

export const BiomeInfoPanel = ({ biome }: MobileBiomeInfoPanelProps) => {
  const troopTypes = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin];

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(${getBiomeImage(biome)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold font-cinzel text-foreground">{biome}</h3>
          <Info className="w-4 h-4 text-muted-foreground" />
        </div>

        <p className="text-sm text-muted-foreground">Combat effectiveness varies by troop type</p>

        <div className="grid grid-cols-3 gap-2">
          {troopTypes.map((troopType) => {
            const config = troopConfig[troopType];
            const bonus = configManager.getBiomeCombatBonus(troopType, biome);
            const styles = getBonusStyles(bonus);

            return (
              <div key={troopType} className={`p-2 rounded-lg border-2 transition-all ${styles.containerClass}`}>
                <div className="flex flex-col items-center gap-1">
                  <ResourceIcon resourceId={config.resourceId} size={20} />
                  <div className={`text-xs font-bold ${styles.textClass}`}>{formatBiomeBonus(bonus)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
