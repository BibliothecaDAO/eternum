import ResourceIcon from "./ResourceIcon";
import { colors, section } from "./styles";

// Define a mapping from resource name to ID in the game-docs context
const resourceNameToId: Record<string, number> = {
  Wood: 3,
  Stone: 1,
  Coal: 2,
  Copper: 4,
  Obsidian: 6,
  Silver: 8,
  Ironwood: 5,
  "Cold Iron": 11,
  Gold: 7,
  Hartwood: 15,
  Diamonds: 14,
  Sapphire: 20,
  Ruby: 13,
  "Deep Crystal": 12,
  Ignium: 16,
  "Ethereal Silica": 21,
  "True Ice": 18,
  "Twilight Quartz": 17,
  "Alchemical Silver": 10,
  Adamantine: 19,
  Mithral: 9,
  Dragonhide: 22,
};

// Probability data for village resources
const resourceProbabilities = [
  { name: "Wood", probability: 19.815 },
  { name: "Stone", probability: 15.556 },
  { name: "Coal", probability: 15.062 },
  { name: "Copper", probability: 10.556 },
  { name: "Obsidian", probability: 8.951 },
  { name: "Silver", probability: 7.13 },
  { name: "Ironwood", probability: 5.031 },
  { name: "Cold Iron", probability: 3.92 },
  { name: "Gold", probability: 3.673 },
  { name: "Hartwood", probability: 2.531 },
  { name: "Diamonds", probability: 1.358 },
  { name: "Sapphire", probability: 0.926 },
  { name: "Ruby", probability: 0.988 },
  { name: "Deep Crystal", probability: 1.049 },
  { name: "Ignium", probability: 0.71 },
  { name: "Ethereal Silica", probability: 0.741 },
  { name: "True Ice", probability: 0.556 },
  { name: "Twilight Quartz", probability: 0.494 },
  { name: "Alchemical Silver", probability: 0.401 },
  { name: "Adamantine", probability: 0.278 },
  { name: "Mithral", probability: 0.185 },
  { name: "Dragonhide", probability: 0.093 },
];

// Function to determine rarity tier from resource name
const getRarityTier = (resourceName: string): string => {
  // Common tier resources
  if (["Wood", "Stone", "Coal"].includes(resourceName)) {
    return "common";
  }

  // Uncommon tier resources
  if (["Copper", "Obsidian", "Silver", "Ironwood", "Cold Iron", "Gold"].includes(resourceName)) {
    return "uncommon";
  }

  // Rare tier resources
  if (["Hartwood", "Diamonds", "Sapphire", "Ruby"].includes(resourceName)) {
    return "rare";
  }

  // Epic tier resources
  if (["Deep Crystal", "Ignium", "Ethereal Silica"].includes(resourceName)) {
    return "epic";
  }

  // Legendary tier resources
  if (["True Ice", "Twilight Quartz", "Alchemical Silver"].includes(resourceName)) {
    return "legendary";
  }

  // Mythic tier resources
  if (["Adamantine", "Mithral", "Dragonhide"].includes(resourceName)) {
    return "mythic";
  }

  // Default fallback
  return "unknown";
};

// Component-specific styles
const componentStyles = {
  resourceGridStyle: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1rem",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  resourceItemStyle: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    backgroundColor: colors.background.light,
    borderRadius: "0.5rem",
    padding: "0.75rem",
    borderBottom: `1px solid ${colors.border}`,
    transition: "all 0.2s",
  },
  contentStyle: {
    flexGrow: 1,
  },
  headerStyle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.25rem",
  },
  nameStyle: {
    fontWeight: 500,
    color: colors.text.light,
    fontSize: "0.85rem",
  },
  probabilityStyle: {
    fontSize: "0.875rem",
    fontWeight: "bold",
    color: colors.secondary,
  },
  barContainerStyle: {
    width: "100%",
    backgroundColor: colors.background.medium,
    borderRadius: "9999px",
    height: "0.5rem",
  },
  rarityTextStyle: {
    marginTop: "0.25rem",
    fontSize: "0.75rem",
    color: "#c0c0c0",
    textTransform: "capitalize" as "capitalize",
  },
  legendContainerStyle: {
    marginTop: "2rem",
    display: "flex",
    flexWrap: "wrap" as "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.5rem",
    fontSize: "0.875rem",
    padding: "0.75rem",
    backgroundColor: colors.background.light,
    borderRadius: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
  },
  legendItemStyle: {
    display: "flex",
    alignItems: "center",
    color: colors.text.light,
  },
};

const ResourceProbability = () => {
  // Sort resources by probability (highest to lowest)
  const sortedResources = [...resourceProbabilities].sort((a, b) => b.probability - a.probability);

  // Get bar color based on rarity - using more distinct gold/metallic tones
  const getTierColor = (rarityTier: string) => {
    switch (rarityTier) {
      case "common":
        return "#aa6c39"; // copper
      case "uncommon":
        return "#b78d4b"; // tan gold
      case "rare":
        return "#c19a49"; // bronze gold
      case "epic":
        return "#d4af37"; // darker gold
      case "legendary":
        return "#e5c687"; // pale gold
      default:
        return "#dfc296"; // light gold
    }
  };

  // Function for legend dot style
  const legendDotStyle = (color: string) => ({
    width: "0.75rem",
    height: "0.75rem",
    backgroundColor: color,
    borderRadius: "9999px",
    marginRight: "0.5rem",
  });

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Village Resource Roll Probabilities</div>
      <div style={componentStyles.resourceGridStyle}>
        {sortedResources.map((item) => {
          const id = resourceNameToId[item.name];
          const rarityTier = getRarityTier(item.name);

          if (!id) return null;

          // Calculate the width of the probability bar
          const barWidth = `${Math.max(item.probability * 3, 5)}%`;
          const barColor = getTierColor(rarityTier);

          const barStyle = {
            height: "100%",
            borderRadius: "9999px",
            backgroundColor: barColor,
            width: barWidth,
          };

          return (
            <div
              key={id}
              style={{
                ...componentStyles.resourceItemStyle,
                borderLeft: `3px solid ${barColor}`,
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: "2.5rem",
                  width: "2.5rem",
                  flexShrink: 0,
                }}
              >
                <ResourceIcon name={item.name} id={id} size="md" />
              </div>

              <div style={componentStyles.contentStyle}>
                <div style={componentStyles.headerStyle}>
                  <span style={componentStyles.nameStyle}>{item.name}</span>
                  <span style={{ ...componentStyles.probabilityStyle, color: barColor }}>
                    {item.probability.toFixed(3)}%
                  </span>
                </div>

                <div style={componentStyles.barContainerStyle}>
                  <div style={barStyle}></div>
                </div>

                <div style={{ ...componentStyles.rarityTextStyle, color: barColor }}>{rarityTier}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={componentStyles.legendContainerStyle}>
        <div style={componentStyles.legendItemStyle}>
          <div style={legendDotStyle(getTierColor("common"))}></div>
          <span>Common</span>
        </div>
        <div style={componentStyles.legendItemStyle}>
          <div style={legendDotStyle(getTierColor("uncommon"))}></div>
          <span>Uncommon</span>
        </div>
        <div style={componentStyles.legendItemStyle}>
          <div style={legendDotStyle(getTierColor("rare"))}></div>
          <span>Rare</span>
        </div>
        <div style={componentStyles.legendItemStyle}>
          <div style={legendDotStyle(getTierColor("epic"))}></div>
          <span>Epic</span>
        </div>
        <div style={componentStyles.legendItemStyle}>
          <div style={legendDotStyle(getTierColor("legendary"))}></div>
          <span>Legendary</span>
        </div>
        <div style={componentStyles.legendItemStyle}>
          <div style={legendDotStyle(getTierColor("mythic"))}></div>
          <span>Mythic</span>
        </div>
      </div>
    </div>
  );
};

export default ResourceProbability;
