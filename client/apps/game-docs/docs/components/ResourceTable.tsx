import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { formatAmount, section, table } from "./styles";

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
      <div style={section.title}>Resources</div>

      <div style={section.grid}>
        {/* Basic Resources Section */}
        <div style={section.card}>
          <div style={section.subtitle}>Basic Resources</div>

          <table style={table.table}>
            <thead>
              <tr>
                <th style={table.headerCell}>Resource</th>
                <th style={table.headerCell}>Weight (kg)</th>
                <th style={table.headerCell}>Production</th>
              </tr>
            </thead>
            <tbody>
              {[ResourcesIds.Wheat, ResourcesIds.Fish].map((id) => (
                <tr key={id}>
                  <td style={table.resourceCell}>
                    <ResourceIcon id={id} name={getResourceName(id)} size="md" />
                    {getResourceName(id)}
                  </td>
                  <td style={table.weightCell}>{formatAmount(config.resources.resourceWeightsGrams[id] / 1000000)}</td>
                  <td style={table.cell}>{formatAmount(config.resources.productionBySimpleRecipeOutputs[id])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Starting Resources */}
        <div style={section.card}>
          <div style={section.subtitle}>Starting Resources</div>

          <table style={table.table}>
            <thead>
              <tr>
                <th style={table.headerCell}>Resource</th>
                <th style={table.headerCell}>Realm</th>
                <th style={table.headerCell}>Village</th>
              </tr>
            </thead>
            <tbody>
              {config.startingResources.map(({ resource, amount }) => (
                <tr key={resource}>
                  <td style={table.resourceCell}>
                    <ResourceIcon id={resource} name={getResourceName(resource)} size="md" />
                    {getResourceName(resource)}
                  </td>
                  <td style={table.cell}>{formatAmount(amount)}</td>
                  <td style={table.cell}>
                    {formatAmount(config.villageStartingResources.find((r) => r.resource === resource)?.amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Resource Table */}
      <div style={{ ...section.wrapper, marginTop: "1.5rem", ...section.card }}>
        <div style={section.subtitle}>Resource Production</div>

        <div style={table.wrapper}>
          <table style={table.table}>
            <thead>
              <tr>
                <th style={table.headerCell}>Resource</th>
                <th style={table.headerCell}>Weight (kg)</th>
                <th style={table.headerCell}>Output (p/s)</th>
                <th style={table.headerCell}>Inputs</th>
                <th style={table.headerCell}>Labor Value</th>
              </tr>
            </thead>
            <tbody>
              {resourceTypes.map((id) => {
                const inputs = config.resources.productionByComplexRecipe[id] || [];
                return (
                  <tr key={id}>
                    <td style={table.resourceCell}>
                      <ResourceIcon id={id} name={getResourceName(id)} size="md" />
                      {getResourceName(id)}
                    </td>
                    <td style={table.weightCell}>
                      {formatAmount(config.resources.resourceWeightsGrams[id] / 1000000)}
                    </td>
                    <td style={table.cell}>{formatAmount(config.resources.productionByComplexRecipeOutputs[id])}</td>
                    <td style={table.cell}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {inputs.map((input) => (
                          <div key={input.resource} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{getResourceName(input.resource)}:</span>
                            <span style={{ color: "#dfc296" }}>{formatAmount(input.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={table.cell}>{formatAmount(config.resources.laborOutputPerResource[id])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simple Production System */}
      <div style={{ ...section.wrapper, marginTop: "1.5rem", ...section.card }}>
        <div style={section.subtitle}>Simple Production System</div>

        <div style={table.wrapper}>
          <table style={table.table}>
            <thead>
              <tr>
                <th style={table.headerCell}>Resource</th>
                <th style={table.headerCell}>Output (p/s)</th>
                <th style={table.headerCell}>Labor Input</th>
                <th style={table.headerCell}>Food Input</th>
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
                    <td style={table.resourceCell}>
                      <ResourceIcon id={id} name={getResourceName(id)} size="md" />
                      {getResourceName(id)}
                    </td>
                    <td style={table.cell}>{formatAmount(config.resources.productionBySimpleRecipeOutputs[id])}</td>
                    <td style={table.cell}>{laborInput ? formatAmount(laborInput.amount) : "-"}</td>
                    <td style={table.cell}>
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
