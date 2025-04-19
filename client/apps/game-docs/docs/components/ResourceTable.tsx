import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

// Helper function to format numbers with commas
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount * 100) / 100);
};

// Common styles shared with WeightTable component
const styles = {
  sectionStyle: {
    marginBottom: "2rem",
  },
  subtitleStyle: {
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: "#f0b060",
    marginBottom: "0.75rem",
    marginTop: "1.5rem",
  },
  tableStyle: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.85rem",
  },
  headerCellStyle: {
    padding: "0.5rem",
    backgroundColor: "rgba(60, 40, 20, 0.5)",
    color: "#f0b060",
    fontWeight: "bold",
    textAlign: "left" as const,
    borderBottom: "1px solid #6d4923",
  },
  cellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
  },
  resourceCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  weightCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    color: "#dfc296",
  },
};

export default function ResourceTable() {
  const config = ETERNUM_CONFIG();

  // Filter out troop types, lords, and special resources
  const resourceTypes = Object.values(ResourcesIds).filter(
    (id): id is number =>
      typeof id === "number" &&
      id !== ResourcesIds.Lords &&
      id !== ResourcesIds.Labor &&
      id !== ResourcesIds.AncientFragment &&
      id < ResourcesIds.Donkey, // Exclude troops and special resources
  );

  // Helper function to get resource name
  const getResourceName = (id: number) => {
    const resourceNames: Record<number, string> = {
      [ResourcesIds.Wood]: "Wood",
      [ResourcesIds.Stone]: "Stone",
      [ResourcesIds.Coal]: "Coal",
      [ResourcesIds.Copper]: "Copper",
      [ResourcesIds.Obsidian]: "Obsidian",
      [ResourcesIds.Silver]: "Silver",
      [ResourcesIds.Ironwood]: "Ironwood",
      [ResourcesIds.ColdIron]: "Cold Iron",
      [ResourcesIds.Gold]: "Gold",
      [ResourcesIds.Hartwood]: "Hartwood",
      [ResourcesIds.Diamonds]: "Diamonds",
      [ResourcesIds.Sapphire]: "Sapphire",
      [ResourcesIds.Ruby]: "Ruby",
      [ResourcesIds.DeepCrystal]: "Deep Crystal",
      [ResourcesIds.Ignium]: "Ignium",
      [ResourcesIds.EtherealSilica]: "Ethereal Silica",
      [ResourcesIds.TrueIce]: "True Ice",
      [ResourcesIds.TwilightQuartz]: "Twilight Quartz",
      [ResourcesIds.AlchemicalSilver]: "Alchemical Silver",
      [ResourcesIds.Adamantine]: "Adamantine",
      [ResourcesIds.Mithral]: "Mithral",
      [ResourcesIds.Dragonhide]: "Dragonhide",
      [ResourcesIds.Wheat]: "Wheat",
      [ResourcesIds.Fish]: "Fish",
    };

    return resourceNames[id] || `Resource ${id}`;
  };

  return (
    <div>
      <div style={{ fontWeight: "bold", marginBottom: "1.5rem", fontSize: "1.25rem" }}>Resources</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {/* Basic Resources Section */}
        <div
          style={{
            border: "1px solid #4d3923",
            padding: "1rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(30, 20, 10, 0.3)",
          }}
        >
          <div style={styles.subtitleStyle}>Basic Resources</div>

          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.headerCellStyle}>Resource</th>
                <th style={styles.headerCellStyle}>Weight (kg)</th>
                <th style={styles.headerCellStyle}>Production</th>
              </tr>
            </thead>
            <tbody>
              {[ResourcesIds.Wheat, ResourcesIds.Fish].map((id) => (
                <tr key={id}>
                  <td style={styles.resourceCellStyle}>
                    <ResourceIcon id={id} name={getResourceName(id)} size="md" />
                    {getResourceName(id)}
                  </td>
                  <td style={styles.weightCellStyle}>
                    {formatAmount(config.resources.resourceWeightsGrams[id] / 1000000)}
                  </td>
                  <td style={styles.cellStyle}>{formatAmount(config.resources.productionBySimpleRecipeOutputs[id])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Starting Resources */}
        <div
          style={{
            border: "1px solid #4d3923",
            padding: "1rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(30, 20, 10, 0.3)",
          }}
        >
          <div style={styles.subtitleStyle}>Starting Resources</div>

          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.headerCellStyle}>Resource</th>
                <th style={styles.headerCellStyle}>Realm</th>
                <th style={styles.headerCellStyle}>Village</th>
              </tr>
            </thead>
            <tbody>
              {config.startingResources.map(({ resource, amount }) => (
                <tr key={resource}>
                  <td style={styles.resourceCellStyle}>
                    <ResourceIcon id={resource} name={getResourceName(resource)} size="md" />
                    {getResourceName(resource)}
                  </td>
                  <td style={styles.cellStyle}>{formatAmount(amount)}</td>
                  <td style={styles.cellStyle}>
                    {formatAmount(config.villageStartingResources.find((r) => r.resource === resource)?.amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Resource Table */}
      <div
        style={{
          ...styles.sectionStyle,
          marginTop: "1.5rem",
          border: "1px solid #4d3923",
          padding: "1rem",
          borderRadius: "0.5rem",
          backgroundColor: "rgba(30, 20, 10, 0.3)",
        }}
      >
        <div style={styles.subtitleStyle}>Resource Production</div>

        <div style={{ overflowX: "auto" }}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.headerCellStyle}>Resource</th>
                <th style={styles.headerCellStyle}>Weight (kg)</th>
                <th style={styles.headerCellStyle}>Output (p/s)</th>
                <th style={styles.headerCellStyle}>Inputs</th>
                <th style={styles.headerCellStyle}>Labor Value</th>
              </tr>
            </thead>
            <tbody>
              {resourceTypes.map((id) => {
                const inputs = config.resources.productionByComplexRecipe[id] || [];
                return (
                  <tr key={id}>
                    <td style={styles.resourceCellStyle}>
                      <ResourceIcon id={id} name={getResourceName(id)} size="md" />
                      {getResourceName(id)}
                    </td>
                    <td style={styles.weightCellStyle}>
                      {formatAmount(config.resources.resourceWeightsGrams[id] / 1000000)}
                    </td>
                    <td style={styles.cellStyle}>
                      {formatAmount(config.resources.productionByComplexRecipeOutputs[id])}
                    </td>
                    <td style={styles.cellStyle}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {inputs.map((input) => (
                          <div key={input.resource} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{getResourceName(input.resource)}:</span>
                            <span style={{ color: "#dfc296" }}>{formatAmount(input.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={styles.cellStyle}>{formatAmount(config.resources.laborOutputPerResource[id])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Production System */}
      <div
        style={{
          ...styles.sectionStyle,
          marginTop: "1.5rem",
          border: "1px solid #4d3923",
          padding: "1rem",
          borderRadius: "0.5rem",
          backgroundColor: "rgba(30, 20, 10, 0.3)",
        }}
      >
        <div style={styles.subtitleStyle}>Simple Production System</div>

        <div style={{ overflowX: "auto" }}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.headerCellStyle}>Resource</th>
                <th style={styles.headerCellStyle}>Output (p/s)</th>
                <th style={styles.headerCellStyle}>Labor Input</th>
                <th style={styles.headerCellStyle}>Food Input</th>
              </tr>
            </thead>
            <tbody>
              {resourceTypes.map((id) => {
                const inputs = config.resources.productionBySimpleRecipe[id] || [];
                const laborInput = inputs.find((input) => input.resource === ResourcesIds.Labor);
                const foodInput = inputs.find(
                  (input) => input.resource === ResourcesIds.Wheat || input.resource === ResourcesIds.Fish,
                );

                return (
                  <tr key={id}>
                    <td style={styles.resourceCellStyle}>
                      <ResourceIcon id={id} name={getResourceName(id)} size="md" />
                      {getResourceName(id)}
                    </td>
                    <td style={styles.cellStyle}>
                      {formatAmount(config.resources.productionBySimpleRecipeOutputs[id])}
                    </td>
                    <td style={styles.cellStyle}>{laborInput ? formatAmount(laborInput.amount) : "-"}</td>
                    <td style={styles.cellStyle}>
                      {foodInput ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span>{getResourceName(foodInput.resource)}</span>
                          <span style={{ color: "#dfc296" }}>{formatAmount(foodInput.amount)}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
