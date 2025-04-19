import { ETERNUM_CONFIG } from "@/utils/config";

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
    color: "#ff6b6b",
    fontWeight: "bold",
  },
  negativeModifier: {
    color: "#69db7c",
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

    let style = styles.noModifier;
    if (diff > 0) style = styles.positiveModifier;
    if (diff < 0) style = styles.negativeModifier;

    return <div style={style}>{cost}</div>;
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
      <h2 style={styles.title}>Biome Movement Stamina Costs</h2>

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

      <div style={styles.legend}>
        <p>
          <span style={styles.negativeModifier}>Green values</span> indicate reduced stamina cost (advantageous).
          <br />
          <span style={styles.positiveModifier}>Red values</span> indicate increased stamina cost (disadvantageous).
          <br />
          Base stamina cost for movement: {baseStaminaCost} per hex.
          <br />
          Biome modifier value: ±{biomeBonus}
        </p>
      </div>
    </div>
  );
};
