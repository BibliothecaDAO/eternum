import { ETERNUM_CONFIG } from "@/utils/config";
import React from "react";
import { colors, icon, modifiers, section, table } from "./styles";

// Biome types enum to match the provided code
enum BiomeType {
  None = "None",
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
    case BiomeType.None:
      return "❓";
    default:
      return "❓";
  }
};

// Function to get troop icon
const getTroopIcon = (troopType: TroopType): string => {
  switch (troopType) {
    case TroopType.Paladin:
      return "🐴";
    case TroopType.Knight:
      return "⚔️";
    case TroopType.Crossbowman:
      return "🏹";
    default:
      return "👤";
  }
};

export const BiomeCombat = () => {
  const config = ETERNUM_CONFIG();
  const biomeBonusNum = config.troop.damage.damageBiomeBonusNum || 0;
  const biomeBonus = biomeBonusNum / 10_000;

  // Function to calculate the combat bonus based on biome and troop type
  const getBiomeCombatBonus = (biome: BiomeType, troopType: TroopType) => {
    const biomeModifiers: Record<BiomeType, Record<TroopType, number>> = {
      [BiomeType.None]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: 0 },
      [BiomeType.Ocean]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.DeepOcean]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.Beach]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: 0,
      },
      [BiomeType.Grassland]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -biomeBonus,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.Shrubland]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -biomeBonus,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.SubtropicalDesert]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.TemperateDesert]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.TropicalRainForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.TropicalSeasonalForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.TemperateRainForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.TemperateDeciduousForest]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.Tundra]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.Taiga]: {
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
      [BiomeType.Snow]: {
        [TroopType.Knight]: -biomeBonus,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: 0,
      },
      [BiomeType.Bare]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -biomeBonus,
        [TroopType.Paladin]: biomeBonus,
      },
      [BiomeType.Scorched]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: biomeBonus,
        [TroopType.Paladin]: -biomeBonus,
      },
    };

    return 1 + (biomeModifiers[biome]?.[troopType] ?? 0);
  };

  // Render function for the combat bonus
  const renderCombatBonus = (biome: BiomeType, troopType: TroopType) => {
    const bonus = getBiomeCombatBonus(biome, troopType) - 1;
    if (bonus > 0) {
      return <span style={modifiers.positive}>+{(bonus * 100).toFixed(0)}%</span>;
    } else if (bonus < 0) {
      return <span style={modifiers.negative}>{(bonus * 100).toFixed(0)}%</span>;
    } else {
      return <span style={modifiers.neutral}>0%</span>;
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
      <div style={section.accentedTitle}>Biome Combat Modifiers</div>

      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Biome</th>
              <th style={table.headerCell}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={icon.biome}>{getTroopIcon(TroopType.Knight)}</span> Knight
                </div>
              </th>
              <th style={table.headerCell}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={icon.biome}>{getTroopIcon(TroopType.Crossbowman)}</span> Crossbowman
                </div>
              </th>
              <th style={table.headerCell}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={icon.biome}>{getTroopIcon(TroopType.Paladin)}</span> Paladin
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {biomeGroups.map((group) => (
              <React.Fragment key={group.name}>
                <tr>
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
                    <td style={table.cell}>
                      <span style={icon.biome}>{getBiomeIcon(biome)}</span>
                      {biome.replace(/([A-Z])/g, " $1").trim()}
                    </td>
                    <td style={{ ...table.cell, textAlign: "center" }}>{renderCombatBonus(biome, TroopType.Knight)}</td>
                    <td style={{ ...table.cell, textAlign: "center" }}>
                      {renderCombatBonus(biome, TroopType.Crossbowman)}
                    </td>
                    <td style={{ ...table.cell, textAlign: "center" }}>
                      {renderCombatBonus(biome, TroopType.Paladin)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div style={section.legend}>
        Note: These modifiers affect combat damage in different biomes. Positive values mean the troop does more damage
        in that biome, negative values mean they do less damage.
      </div>
    </div>
  );
};
