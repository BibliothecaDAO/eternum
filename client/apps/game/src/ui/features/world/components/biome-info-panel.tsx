import { formatBiomeBonus } from "@/ui/features/military/battle/combat-utils";
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

export const BiomeInfoPanel = ({ biome, compact = false }: { biome: BiomeType; compact?: boolean }) => {
  return (
    <div
      className={`${compact ? "p-2" : "p-4"} rounded-lg backdrop-blur-sm shadow-inner relative overflow-hidden h-full`}
      style={{
        backgroundImage: `url(${getBiomeImage(biome)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-dark-brown/70 backdrop-blur-sm"></div>

      <div
        className={`flex ${compact ? "flex-col gap-2" : "flex-col sm:flex-row items-start sm:items-center justify-between gap-4"} relative z-10 h-full`}
      >
        <div>
          <h2 className={`${compact ? "text-lg" : "text-2xl"} font-bold text-gold flex items-center gap-2`}>{biome}</h2>
          {!compact && (
            <p className="text-sm text-gold/60 mt-1">Terrain affects combat effectiveness of different troop types</p>
          )}
        </div>

        <div className={`flex flex-wrap gap-2 ${compact ? "mt-1" : "mt-2 sm:mt-0"}`}>
          <div
            className={`${compact ? "px-2 py-1" : "px-3 py-2"} rounded-md border ${configManager.getBiomeCombatBonus(TroopType.Knight, biome) > 0 ? "border-green-500/50 bg-green-900/20" : configManager.getBiomeCombatBonus(TroopType.Knight, biome) < 0 ? "border-red-500/50 bg-red-900/20" : "border-gold/20 bg-brown-800/50"}`}
          >
            <div className="text-xs uppercase tracking-wider text-gold mb-0.5">Melee</div>
            <div className={`${compact ? "text-base" : "text-lg"} font-bold`}>
              {formatBiomeBonus(configManager.getBiomeCombatBonus(TroopType.Knight, biome))}
            </div>
          </div>

          <div
            className={`${compact ? "px-2 py-1" : "px-3 py-2"} rounded-md border ${configManager.getBiomeCombatBonus(TroopType.Crossbowman, biome) > 0 ? "border-green-500/50 bg-green-900/20" : configManager.getBiomeCombatBonus(TroopType.Crossbowman, biome) < 0 ? "border-red-500/50 bg-red-900/20" : "border-gold/20 bg-brown-800/50"}`}
          >
            <div className="text-xs uppercase tracking-wider text-gold mb-0.5">Ranged</div>
            <div className={`${compact ? "text-base" : "text-lg"} font-bold`}>
              {formatBiomeBonus(configManager.getBiomeCombatBonus(TroopType.Crossbowman, biome))}
            </div>
          </div>

          <div
            className={`${compact ? "px-2 py-1" : "px-3 py-2"} rounded-md border ${configManager.getBiomeCombatBonus(TroopType.Paladin, biome) > 0 ? "border-green-500/50 bg-green-900/20" : configManager.getBiomeCombatBonus(TroopType.Paladin, biome) < 0 ? "border-red-500/50 bg-red-900/20" : "border-gold/20 bg-brown-800/50"}`}
          >
            <div className="text-xs uppercase tracking-wider text-gold mb-0.5">Paladins</div>
            <div className={`${compact ? "text-base" : "text-lg"} font-bold`}>
              {formatBiomeBonus(configManager.getBiomeCombatBonus(TroopType.Paladin, biome))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
