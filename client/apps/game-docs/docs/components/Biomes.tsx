import { colors, section } from "./styles";

export const Biomes = () => {
  // Map biome names to their corresponding image filenames
  const biomeImageMap: Record<string, string> = {
    bare: "bare.png",
    beach: "beach.png",
    deepOcean: "deepocean.png",
    grassland: "grassland.png",
    ocean: "ocean.png",
    scorched: "scorched.png",
    shrubland: "shrublands.png", // Note the "s" at the end
    snow: "snow.png",
    subtropicalDesert: "subtropicaldesert.png",
    taiga: "taiga.png",
    temperateDesert: "temperatedesert.png",
    decidiousForest: "decidiousforest.png",
    temperateRainforest: "temperaterainforest.png",
    tropicalRainforest: "rainforest.png", // Different naming
    tropicalSeasonalForest: "tropicalseasonalforest.png",
    tundra: "tundra.png",
  };

  // List of all biomes
  const biomes = Object.keys(biomeImageMap);

  // Helper function to format biome name for display
  const formatBiomeName = (name: string) => {
    return name
      .replace(/([A-Z])/g, " $1") // Add space before capital letters
      .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter
  };

  // Additional styles specific to this component
  const styles = {
    biomesGridStyle: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
      gap: "1rem",
    },
    biomeCardStyle: {
      borderRadius: "6px",
      overflow: "hidden",
      backgroundColor: colors.background.light,
      border: `1px solid ${colors.border}`,
    },
    biomeHeaderStyle: {
      padding: "0.75rem",
      backgroundColor: colors.background.header,
      color: colors.primary,
      fontWeight: "bold",
      borderBottom: `1px solid ${colors.borderDark}`,
      margin: 0,
      fontSize: "1rem",
      textAlign: "center" as const,
    },
    biomeImageContainerStyle: {
      width: "100%",
      height: "160px",
      overflow: "hidden",
    },
    biomeImageStyle: {
      width: "100%",
      height: "100%",
      objectFit: "cover" as const,
    },
  };

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Available Biome Types</div>
      <div style={styles.biomesGridStyle}>
        {biomes.map((biome) => (
          <div key={biome} style={styles.biomeCardStyle}>
            <h3 style={styles.biomeHeaderStyle}>{formatBiomeName(biome)}</h3>
            <div style={styles.biomeImageContainerStyle}>
              <img
                src={`/images/biomes/${biomeImageMap[biome]}`}
                alt={`${formatBiomeName(biome)} biome`}
                style={styles.biomeImageStyle}
                onError={(e) => {
                  // Fallback if image loading fails
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  target.parentElement!.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: rgba(20, 15, 10, 0.5); color: #dfc296; flex-direction: column; padding: 8px;">
                      <div>Image not available</div>
                      <div><code>${biomeImageMap[biome]}</code></div>
                    </div>
                  `;
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
