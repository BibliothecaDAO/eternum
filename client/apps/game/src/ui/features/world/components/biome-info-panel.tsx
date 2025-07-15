import { formatBiomeBonus } from "@/ui/features/military";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, TroopType } from "@bibliothecadao/types";
import { Info, Shield, Sword, Target } from "lucide-react";

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

// Troop type configuration with icons and labels
const troopConfig = {
  [TroopType.Knight]: {
    icon: Sword,
    label: "Knights",
  },
  [TroopType.Crossbowman]: {
    icon: Target,
    label: "Crossbowmen",
  },
  [TroopType.Paladin]: {
    icon: Shield,
    label: "Paladins",
  },
};

// Get bonus styling based on value
const getBonusStyles = (bonus: number) => {
  if (bonus > 0) {
    return {
      containerClass: "border-green-500/60 bg-green-900/30 shadow-green-500/20",
      textClass: "text-green-300",
      iconClass: "text-green-400",
    };
  } else if (bonus < 0) {
    return {
      containerClass: "border-red-500/60 bg-red-900/30 shadow-red-500/20",
      textClass: "text-red-300",
      iconClass: "text-red-400",
    };
  }
  return {
    containerClass: "border-gold/30 bg-brown-800/60 shadow-gold/10",
    textClass: "text-gold/90",
    iconClass: "text-gold/70",
  };
};

export const BiomeInfoPanel = ({ biome }: { biome: BiomeType }) => {
  const troopTypes = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin];

  return (
    <div
      className="p-3 rounded-xl border-2 border-gold/20 backdrop-blur-sm shadow-lg relative overflow-hidden h-full transition-all duration-300 hover:border-gold/30 hover:shadow-xl"
      style={{
        backgroundImage: `linear-gradient(rgba(20, 16, 13, 0.85), rgba(20, 16, 13, 0.85)), url(${getBiomeImage(biome)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Wood panel border overlay */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent bg-gradient-to-br from-gold/5 to-transparent pointer-events-none" />

      <div className="flex flex-col gap-3 h-full relative z-10">
        {/* Biome Header */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-gold font-cinzel">{biome}</h2>
            <div className="group relative">
              <Info className="w-4 h-4 text-gold/60 hover:text-gold transition-colors" />
              <div className="absolute left-6 top-0 hidden group-hover:block z-50">
                <div className="bg-brown-900/95 border border-gold/30 rounded-lg p-3 text-sm text-gold/90 whitespace-nowrap shadow-xl">
                  Terrain affects combat effectiveness
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gold/70 font-medium">Combat effectiveness varies by troop type</p>
        </div>

        {/* Troop Effectiveness Cards */}
        <div className="flex flex-row gap-2 flex-shrink-0">
          {troopTypes.map((troopType) => {
            const config = troopConfig[troopType];
            const Icon = config.icon;
            const bonus = configManager.getBiomeCombatBonus(troopType, biome);
            const styles = getBonusStyles(bonus);

            return (
              <div
                key={troopType}
                className={`group relative px-2 py-1.5 min-w-[70px] rounded-lg border-2 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105  ${
                  styles.containerClass
                }`}
                role="tooltip"
                aria-label={`${config.label}: ${formatBiomeBonus(bonus)} combat effectiveness`}
              >
                {/* Tooltip (removed description) */}

                {/* Icon and Label */}
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3 h-3 ${styles.iconClass}`} />
                  <div className={`text-xs uppercase tracking-wider font-semibold ${styles.textClass}`}>
                    {config.label}
                  </div>
                </div>

                {/* Bonus Value */}
                <div className={`text-sm font-bold text-center ${styles.textClass}`}>{formatBiomeBonus(bonus)}</div>

                {/* Subtle glow effect for active bonuses */}
                {bonus !== 0 && (
                  <div
                    className={`absolute inset-0 rounded-lg opacity-20 ${
                      bonus > 0 ? "bg-green-400" : "bg-red-400"
                    } animate-pulse pointer-events-none`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
