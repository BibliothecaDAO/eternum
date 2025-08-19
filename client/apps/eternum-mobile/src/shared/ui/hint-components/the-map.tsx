export const TheMap = () => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">The Map</h2>
        <p className="text-muted-foreground text-sm">Navigate the world of Eternum</p>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Exploration & Discovery</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            The world map is procedurally generated and initially shrouded in darkness. Send armies to explore hexes,
            reveal resources, discover world structures, and uncover the secrets of Eternum. Each hex exploration
            requires stamina and may reward you with valuable discoveries.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Biomes & Terrain</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Eternum features 16 unique biome types that affect combat effectiveness and troop movement. Understanding
            terrain advantages and adapting your strategy accordingly is crucial for successful expansion and warfare.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Strategic Navigation</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Use the map to plan routes, identify resource-rich areas, locate enemy positions, and coordinate with
            allies. The hexagonal grid system provides tactical depth for movement and positioning.
          </p>
        </div>
      </div>
    </div>
  );
};
