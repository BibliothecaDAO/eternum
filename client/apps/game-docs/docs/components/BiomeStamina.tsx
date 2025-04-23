import { ETERNUM_CONFIG } from "@/utils/config";
import { colors, icon, modifiers, section, table } from "./styles";

// Biome types enum to match the provided code
enum BiomeType {
  Ocean = "Ocean",
  DeepOcean = "DeepOcean",
  Beach = "Beach",
  Grassland = "Grassland",
  Shrubland = "Shrubland",
  SubtropicalDesert = "SubtropicalDesert",
  TemperateDesert = "TemperateDesert",
  TropicalRainForest = "TropicalRainForest",
  TropicalSeasonalForest = "TropicalSeasonalForest",
  TemperateRainForest = "TemperateRainForest",
  TemperateDeciduousForest = "TemperateDeciduousForest",
  Tundra = "Tundra",
  Taiga = "Taiga",
  Snow = "Snow",
  Bare = "Bare",
  Scorched = "Scorched",
}

// Troop types enum
enum TroopType {
  Paladin = "Paladin",
  Knight = "Knight",
  Crossbowman = "Crossbowman",
}

// Function to get biome icon
const getBiomeIcon = (biome: BiomeType): string => {
  switch (biome) {
    case BiomeType.Ocean:
    case BiomeType.DeepOcean:
      return "🌊";
    case BiomeType.Beach:
      return "🏖️";
    case BiomeType.Grassland:
      return "🌿";
    case BiomeType.Shrubland:
      return "🌱";
    case BiomeType.SubtropicalDesert:
    case BiomeType.TemperateDesert:
      return "🏜️";
    case BiomeType.TropicalRainForest:
    case BiomeType.TropicalSeasonalForest:
    case BiomeType.TemperateRainForest:
    case BiomeType.TemperateDeciduousForest:
      return "🌳";
    case BiomeType.Tundra:
      return "🥶";
    case BiomeType.Taiga:
      return "🌲";
    case BiomeType.Snow:
      return "❄️";
    case BiomeType.Bare:
      return "⛰️";
    case BiomeType.Scorched:
      return "🔥";
    default:
      return "❓";
  }
};

// Function to get troop icon
const getTroopIcon = (troopType: TroopType): string => {
  switch (troopType) {
    case TroopType.Paladin:
      return "🛡️";
    case TroopType.Knight:
      return "⚔️";
    case TroopType.Crossbowman:
      return "🏹";
    default:
      return "👤";
  }
};

export const BiomeStamina = () => {
  const config = ETERNUM_CONFIG();
  const baseStaminaCost = config.troop.stamina.staminaTravelStaminaCost || 0;
  const biomeBonus = config.troop.stamina.staminaBonusValue || 0;

  // Function to calculate the stamina cost based on biome and troop type
  const getTravelStaminaCost = (biome: BiomeType, troopType: TroopType) => {
    // Biome-specific modifiers per troop type
    switch (biome) {
      case BiomeType.Ocean:
      case BiomeType.DeepOcean:
        return baseStaminaCost - biomeBonus; // -10 for all troops
      case BiomeType.Beach:
        return baseStaminaCost; // No modifier
      case BiomeType.Grassland:
      case BiomeType.Shrubland:
      case BiomeType.SubtropicalDesert:
      case BiomeType.TemperateDesert:
      case BiomeType.Tundra:
      case BiomeType.Bare:
        return baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0);
      case BiomeType.TropicalRainForest:
      case BiomeType.TropicalSeasonalForest:
      case BiomeType.TemperateRainForest:
      case BiomeType.TemperateDeciduousForest:
      case BiomeType.Taiga:
        return baseStaminaCost + (troopType === TroopType.Paladin ? biomeBonus : 0);
      case BiomeType.Snow:
        return baseStaminaCost + (troopType !== TroopType.Paladin ? biomeBonus : 0);
      case BiomeType.Scorched:
        return baseStaminaCost + biomeBonus; // +10 for all troops
      default:
        return baseStaminaCost;
    }
  };

  // Function to render cell content with appropriate styling
  const renderStaminaCost = (biome: BiomeType, troopType: TroopType) => {
    const cost = getTravelStaminaCost(biome, troopType);
    const diff = cost - baseStaminaCost;

    // Note: For stamina, lower is better so the colors are reversed from combat
    if (diff > 0) {
      return <div style={modifiers.negative}>{cost}</div>;
    } else if (diff < 0) {
      return <div style={modifiers.positive}>{cost}</div>;
    } else {
      return <div style={modifiers.neutral}>{cost}</div>;
    }
  };

  // Group biomes into categories for better organization
  const biomeGroups = [
    {
      name: "Water Biomes",
      biomes: [BiomeType.Ocean, BiomeType.DeepOcean, BiomeType.Beach],
    },
    {
      name: "Open Biomes",
      biomes: [BiomeType.Grassland, BiomeType.Shrubland, BiomeType.SubtropicalDesert, BiomeType.TemperateDesert],
    },
    {
      name: "Forest Biomes",
      biomes: [
        BiomeType.TropicalRainForest,
        BiomeType.TropicalSeasonalForest,
        BiomeType.TemperateRainForest,
        BiomeType.TemperateDeciduousForest,
        BiomeType.Taiga,
      ],
    },
    {
      name: "Cold Biomes",
      biomes: [BiomeType.Tundra, BiomeType.Snow],
    },
    {
      name: "Harsh Biomes",
      biomes: [BiomeType.Bare, BiomeType.Scorched],
    },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Biome Movement Stamina Costs</div>

      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Biome</th>
              {Object.values(TroopType).map((troopType) => (
                <th key={troopType} style={table.headerCell}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={icon.wrapper}>{getTroopIcon(troopType)}</span>
                    {troopType}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {biomeGroups.map((group) => (
              <>
                <tr key={group.name}>
                  <td
                    colSpan={4}
                    style={{
                      ...table.cell,
                      textAlign: "left",
                      fontWeight: "bold",
                      backgroundColor: colors.background.medium,
                      color: colors.primary,
                    }}
                  >
                    {group.name}
                  </td>
                </tr>
                {group.biomes.map((biome) => (
                  <tr key={biome}>
                    <td style={table.resourceCell}>
                      <span style={icon.biome}>{getBiomeIcon(biome)}</span>
                      {biome.replace(/([A-Z])/g, " $1").trim()}
                    </td>
                    {Object.values(TroopType).map((troopType) => (
                      <td key={`${biome}-${troopType}`} style={{ ...table.cell, textAlign: "center" }}>
                        {renderStaminaCost(biome, troopType)}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div style={section.legend}>
        <p>
          <span style={modifiers.positive}>Green values</span> indicate reduced stamina cost (advantageous).
          <br />
          <span style={modifiers.negative}>Red values</span> indicate increased stamina cost (disadvantageous).
          <br />
          Base stamina cost for movement: {baseStaminaCost} per hex.
          <br />
          Biome modifier value: ±{biomeBonus}
        </p>
      </div>
    </div>
  );
};
