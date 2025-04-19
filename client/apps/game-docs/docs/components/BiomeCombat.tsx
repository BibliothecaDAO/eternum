import { ETERNUM_CONFIG } from "@/utils/config";

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

// Styles for the component
const styles = {
  container: {
    marginBottom: "2.5rem",
  },
  title: {
    fontWeight: "bold",
    fontSize: "1.2rem",
    color: "#f0b060",
    marginBottom: "1.5rem",
    borderLeft: "3px solid #f0b060",
    paddingLeft: "0.75rem",
  },
  tableContainer: {
    overflowX: "auto" as const,
    borderRadius: "0.75rem",
    backgroundColor: "rgba(40, 30, 20, 0.5)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
    marginBottom: "1.5rem",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.9rem",
  },
  tableHead: {
    backgroundColor: "rgba(40, 30, 20, 0.7)",
  },
  tableHeaderCell: {
    textAlign: "center" as const,
    padding: "0.75rem 1rem",
    color: "#f0b060",
    fontWeight: "bold",
    borderBottom: "1px solid #6d4923",
  },
  biomeCell: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid rgba(109, 73, 35, 0.3)",
    color: "#f9fafb",
    fontWeight: 500,
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "0.5rem",
  },
  tableCell: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid rgba(109, 73, 35, 0.3)",
    textAlign: "center" as const,
    color: "#dfc296",
  },
  positiveModifier: {
    color: "#69db7c",
    fontWeight: "bold",
  },
  negativeModifier: {
    color: "#ff6b6b",
    fontWeight: "bold",
  },
  noModifier: {
    color: "#dfc296",
  },
  biomeIcon: {
    display: "inline-block",
    width: "1.5rem",
    textAlign: "center" as const,
  },
  iconWrapper: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: "2rem",
    height: "2rem",
    borderRadius: "50%",
    backgroundColor: "rgba(240, 176, 96, 0.1)",
    marginRight: "0.5rem",
  },
  legend: {
    backgroundColor: "rgba(30, 20, 10, 0.4)",
    padding: "1rem 1.5rem",
    borderRadius: "0.5rem",
    marginTop: "1rem",
    fontStyle: "italic" as const,
    fontSize: "0.9rem",
    color: "#f9fafb",
    opacity: 0.85,
  },
};

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
      return "🛡️";
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
        [TroopType.Knight]: biomeBonus,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -biomeBonus,
      },
    };

    return 1 + (biomeModifiers[biome]?.[troopType] ?? 0);
  };

  // Function to render cell content with appropriate styling
  const renderCombatBonus = (biome: BiomeType, troopType: TroopType) => {
    const bonus = getBiomeCombatBonus(biome, troopType);
    const diff = bonus - 1;

    let style = styles.noModifier;
    if (diff > 0) style = styles.positiveModifier;
    if (diff < 0) style = styles.negativeModifier;

    // Format the bonus as a percentage with a sign
    const formattedBonus = diff === 0 ? "0%" : `${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)}%`;

    return <div style={style}>{formattedBonus}</div>;
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
    <div style={styles.container}>
      <h2 style={styles.title}>Biome Combat Bonuses</h2>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeaderCell}>Biome</th>
              {Object.values(TroopType).map((troopType) => (
                <th key={troopType} style={styles.tableHeaderCell}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={styles.iconWrapper}>{getTroopIcon(troopType)}</span>
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
                      ...styles.tableCell,
                      textAlign: "left",
                      fontWeight: "bold",
                      backgroundColor: "rgba(40, 30, 20, 0.5)",
                      color: "#f0b060",
                    }}
                  >
                    {group.name}
                  </td>
                </tr>
                {group.biomes.map((biome) => (
                  <tr key={biome}>
                    <td style={styles.biomeCell}>
                      <span style={styles.biomeIcon}>{getBiomeIcon(biome)}</span>
                      {biome.replace(/([A-Z])/g, " $1").trim()}
                    </td>
                    {Object.values(TroopType).map((troopType) => (
                      <td key={`${biome}-${troopType}`} style={styles.tableCell}>
                        {renderCombatBonus(biome, troopType)}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.legend}>
        <p>
          <span style={styles.positiveModifier}>Green values</span> indicate increased damage (advantageous).
          <br />
          <span style={styles.negativeModifier}>Red values</span> indicate decreased damage (disadvantageous).
          <br />
          Biome combat modifier value: ±{(biomeBonus * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );
};
