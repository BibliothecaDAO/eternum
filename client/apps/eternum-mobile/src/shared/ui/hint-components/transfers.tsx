export const Transfers = () => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Transfers</h2>
        <p className="text-muted-foreground text-sm">Move resources efficiently across the realm</p>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Resource Movement</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Transfer resources between your structures to optimize production and defense. Strategic resource
            positioning is crucial for maintaining efficient operations.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Transport Logistics</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Plan your supply lines carefully. Consider travel time, donkey requirements, and potential risks when moving
            valuable resources across the map.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30">
          <h3 className="text-lg font-semibold mb-3 text-primary">Strategic Positioning</h3>
          <p className="text-sm leading-relaxed text-foreground/90">
            Position resources strategically for quick access during conflicts, efficient production chains, and
            protection from enemy raids.
          </p>
        </div>
      </div>
    </div>
  );
};
