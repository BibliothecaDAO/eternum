import { ETERNUM_CONFIG } from "@/utils/config";
import { RESOURCE_RARITY, ResourcesIds, resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors } from "./styles";

const isMilitary = (id: number): boolean => {
  if (id === ResourcesIds.Knight) return true;
  if (id === ResourcesIds.KnightT2) return true;
  if (id === ResourcesIds.KnightT3) return true;
  if (id === ResourcesIds.Crossbowman) return true;
  if (id === ResourcesIds.CrossbowmanT2) return true;
  if (id === ResourcesIds.CrossbowmanT3) return true;
  if (id === ResourcesIds.Paladin) return true;
  if (id === ResourcesIds.PaladinT2) return true;
  if (id === ResourcesIds.PaladinT3) return true;
  return false;
};

// Helper function to format numbers with commas
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount * 1000) / 1000);
};

// Common styles shared between components
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
    minWidth: "fit-content",
  },
  tableWrapperStyle: {
    width: "100%",
    overflowX: "auto" as const,
    borderRadius: "0.5rem",
    border: "1px solid #4d3923",
    scrollbarWidth: "thin" as const,
    scrollbarColor: "#8b4513 #2d1b13",
  },
  headerCellStyle: {
    padding: "0.5rem",
    backgroundColor: "rgba(60, 40, 20, 0.5)",
    color: "#f0b060",
    fontWeight: "bold",
    textAlign: "left" as const,
    borderBottom: "1px solid #6d4923",
    whiteSpace: "nowrap" as const,
  },
  cellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    whiteSpace: "nowrap" as const,
  },
  resourceCellStyle: {
    padding: "0.8rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    whiteSpace: "nowrap" as const,
    minWidth: "200px",
  },
  productionCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    color: "#dfc296",
    whiteSpace: "nowrap" as const,
  },
  resourceGroupStyle: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.25rem",
    alignItems: "center",
  },
  resourceItemStyle: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.125rem 0.25rem",
    backgroundColor: "rgba(40, 30, 25, 0.6)",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
    whiteSpace: "nowrap" as const,
    minWidth: "fit-content",
  },
};

// Helper function to get resource name
const getResourceName = (id: number): string => {
  return resources.find((r) => r.id === id)?.trait || `Resource ${id}`;
};

// Component-specific styles
const componentStyles = {
  infoStyle: {
    marginTop: "0.5rem",
    marginBottom: "1rem",
    padding: "0.5rem 1rem",
    backgroundColor: "rgba(255, 220, 150, 0.1)",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    color: colors.text.light,
    borderLeft: `3px solid ${colors.primary}`,
  },
  gridStyle: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "1rem",
    marginTop: "1rem",
    marginBottom: "1rem",
  },
  sectionItemStyle: {
    backgroundColor: colors.background.light,
    borderBottom: `1px solid ${colors.border}`,
    borderRadius: "0.5rem",
    padding: "1rem",
  },
  sectionTitleStyle: {
    fontSize: "0.875rem",
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: "0.75rem",
  },
  valueStyle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.5rem",
    fontSize: "0.875rem",
  },
  labelStyle: {
    color: colors.text.muted,
  },
  amountStyle: {
    fontWeight: 500,
    color: colors.text.light,
  },
  buildingRequiredStyle: {
    fontSize: "0.75rem",
    color: colors.primary,
    fontStyle: "italic",
  },
  tableFootnoteStyle: {
    fontSize: "0.75rem",
    color: colors.text.muted,
    marginTop: "0.5rem",
    fontStyle: "italic",
  },
};

// Component for Simple Mode Resource Production
export const SimpleResourceProduction = () => {
  const config = ETERNUM_CONFIG();
  const resourceInputSimpleMode = config.resources?.productionBySimpleRecipe || {};
  const resourceOutputSimpleMode = config.resources?.productionBySimpleRecipeOutputs || {};

  // Get all resource IDs with production data for simple mode
  const simpleResourceIds = Object.keys(resourceInputSimpleMode)
    .map(Number)
    .filter((id) => id !== ResourcesIds.Labor && resourceInputSimpleMode[id]?.length > 0)
    .filter((id) => !isMilitary(id))
    .filter((id) => id !== ResourcesIds.Donkey)
    .sort((a, b) => {
      // Sort by resource rarity (if available)
      const rarityA = RESOURCE_RARITY[a] || 0;
      const rarityB = RESOURCE_RARITY[b] || 0;
      return rarityA - rarityB;
    });

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Simple Mode Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Realm Output (units/s)</th>
              <th style={styles.headerCellStyle}>Village Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {simpleResourceIds.map((resourceId) => {
              const resourceName = getResourceName(resourceId);
              const realmOutputAmount = resourceOutputSimpleMode[resourceId] || 0;
              const villageOutputAmount = realmOutputAmount / 2;

              return (
                <tr key={`simple-${resourceId}`}>
                  <td style={styles.resourceCellStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {resourceName}
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceGroupStyle}>
                      {(resourceInputSimpleMode[resourceId] || []).map((input, idx) => (
                        <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                          <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="md" />
                          {formatAmount(input.amount)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {formatAmount(realmOutputAmount)}
                    </div>
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {formatAmount(villageOutputAmount)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component for Blitz Mode Resource Production (Hardcoded)
export const BlitzSimpleResourceProduction = () => {
  // Hardcoded data for Blitz mode - 9 resources with wheat and labor inputs
  const blitzResources = [
    {
      id: ResourcesIds.Wood,
      name: "Wood",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 1, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 0.5, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Coal,
      name: "Coal",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 1, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 1, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Copper,
      name: "Copper",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 1, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 1, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Ironwood,
      name: "Ironwood",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 2, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 2.5, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.ColdIron,
      name: "Cold Iron",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 2, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 2.5, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Gold,
      name: "Gold",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 2, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 2.5, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Adamantine,
      name: "Adamantine",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 4, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 10, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Mithral,
      name: "Mithral",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 4, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 10, name: "Labor" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Dragonhide,
      name: "Dragonhide",
      inputs: [
        { resource: ResourcesIds.Wheat, amount: 4, name: "Wheat" },
        { resource: ResourcesIds.Labor, amount: 10, name: "Labor" },
      ],
      output: 1,
    },
  ];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Simple Mode Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzResources.map((resource) => (
              <tr key={`blitz-${resource.id}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={resource.id} name={resource.name} size="md" />
                  {resource.name}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceGroupStyle}>
                    {resource.inputs.map((input, idx) => (
                      <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                        <ResourceIcon id={input.resource} name={input.name} size="md" />
                        {input.amount}
                      </div>
                    ))}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resource.id} name={resource.name} size="md" />
                    {resource.output}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={componentStyles.tableFootnoteStyle}>
        {/* DRAFTING NOTE: Hardcoded table for Blitz mode - replace with dynamic data when config is updated */}
      </div>
    </div>
  );
};

// Component for Complex Mode Resource Production
export const StandardResourceProduction = () => {
  const config = ETERNUM_CONFIG();
  const resourceInputComplexMode = config.resources?.productionByComplexRecipe || {};
  const resourceOutputComplexMode = config.resources?.productionByComplexRecipeOutputs || {};

  // Get all resource IDs with production data for complex mode
  const complexResourceIds = Object.keys(resourceInputComplexMode)
    .map(Number)
    .filter((id) => id !== ResourcesIds.Labor && resourceInputComplexMode[id]?.length > 0)
    .filter((id) => !isMilitary(id))
    .filter((id) => id !== ResourcesIds.Donkey)
    .sort((a, b) => {
      // Sort by resource rarity (if available)
      const rarityA = RESOURCE_RARITY[a] || 0;
      const rarityB = RESOURCE_RARITY[b] || 0;
      return rarityA - rarityB;
    });

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Standard Mode Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Realm Output (units/s)</th>
              <th style={styles.headerCellStyle}>Village Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {complexResourceIds.map((resourceId) => {
              const resourceName = getResourceName(resourceId);
              const realmOutputAmount = resourceOutputComplexMode[resourceId] || 0;
              const villageOutputAmount = realmOutputAmount / 2;

              return (
                <tr key={`complex-${resourceId}`}>
                  <td style={styles.resourceCellStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {resourceName}
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceGroupStyle}>
                      {(resourceInputComplexMode[resourceId] || []).map((input, idx) => (
                        <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                          <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="md" />
                          {formatAmount(input.amount)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {formatAmount(realmOutputAmount)}
                    </div>
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {formatAmount(villageOutputAmount)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component for Simple Mode Troop Production
export const SimpleTroopProduction = () => {
  const config = ETERNUM_CONFIG();
  const troopInputSimpleMode = config.resources?.productionBySimpleRecipe || {};
  const troopOutputSimpleMode = config.resources?.productionBySimpleRecipeOutputs || {};

  // Get all troop IDs with production data for simple mode
  const simpleTroopIds = Object.keys(troopInputSimpleMode)
    .map(Number)
    .filter((id) => troopInputSimpleMode[id]?.length > 0)
    .filter((id) => isMilitary(id))
    .sort((a, b) => a - b);

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Simple Mode Troop Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Troop</th>
              <th style={styles.headerCellStyle}>Input Resources</th>
              <th style={styles.headerCellStyle}>Realm Output</th>
              <th style={styles.headerCellStyle}>Village Output</th>
            </tr>
          </thead>
          <tbody>
            {simpleTroopIds.map((troopId) => {
              const troopName = getResourceName(troopId);
              const realmOutputAmount = troopOutputSimpleMode[troopId] || 0;
              const villageOutputAmount = realmOutputAmount / 2;

              return (
                <tr key={`simple-troop-${troopId}`}>
                  <td style={styles.resourceCellStyle}>
                    <ResourceIcon id={troopId} name={troopName} size="md" />
                    {troopName}
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceGroupStyle}>
                      {(troopInputSimpleMode[troopId] || []).map((input, idx) => (
                        <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                          <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="md" />
                          {formatAmount(input.amount)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={troopId} name={troopName} size="md" />
                      {formatAmount(realmOutputAmount)}
                    </div>
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={troopId} name={troopName} size="md" />
                      {formatAmount(villageOutputAmount)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component for Standard Mode Troop Production
export const StandardTroopProduction = () => {
  const config = ETERNUM_CONFIG();
  const troopInputComplexMode = config.resources?.productionByComplexRecipe || {};
  const troopOutputComplexMode = config.resources?.productionByComplexRecipeOutputs || {};

  // Get all troop IDs with production data for complex mode
  const complexTroopIds = Object.keys(troopInputComplexMode)
    .map(Number)
    .filter((id) => troopInputComplexMode[id]?.length > 0)
    .filter((id) => isMilitary(id))
    .sort((a, b) => a - b);

  // Group troops by tier
  const tier1Troops = complexTroopIds.filter((id) =>
    [ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin].includes(id),
  );
  const tier2Troops = complexTroopIds.filter((id) =>
    [ResourcesIds.KnightT2, ResourcesIds.CrossbowmanT2, ResourcesIds.PaladinT2].includes(id),
  );
  const tier3Troops = complexTroopIds.filter((id) =>
    [ResourcesIds.KnightT3, ResourcesIds.CrossbowmanT3, ResourcesIds.PaladinT3].includes(id),
  );

  // Function to render troop rows by tier
  const renderTroopRows = (troopIds: number[]) => {
    return troopIds.map((troopId) => {
      const troopName = getResourceName(troopId);
      const realmOutputAmount = troopOutputComplexMode[troopId] || 0;
      const villageOutputAmount = realmOutputAmount / 2;

      return (
        <tr key={`complex-troop-${troopId}`}>
          <td style={styles.resourceCellStyle}>
            <ResourceIcon id={troopId} name={troopName} size="sm" />
            {troopName}
          </td>
          <td style={styles.productionCellStyle}>
            <div style={styles.resourceGroupStyle}>
              {(troopInputComplexMode[troopId] || []).map((input, idx) => (
                <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                  <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="sm" />
                  {formatAmount(input.amount)}
                </div>
              ))}
            </div>
          </td>
          <td style={styles.productionCellStyle}>
            <div style={styles.resourceItemStyle}>
              <ResourceIcon id={troopId} name={troopName} size="sm" />
              {formatAmount(realmOutputAmount)}
            </div>
          </td>
          <td style={styles.productionCellStyle}>
            <div style={styles.resourceItemStyle}>
              <ResourceIcon id={troopId} name={troopName} size="sm" />
              {formatAmount(villageOutputAmount)}
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Standard Mode Troop Production</div>

      {/* Tier 1 Troops */}
      <div style={{ ...styles.subtitleStyle, fontSize: "0.9rem", marginTop: "1rem" }}>Tier 1 Troops</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Troop</th>
              <th style={{ ...styles.headerCellStyle, width: "50%", minWidth: "300px" }}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Realm Output (units/s)</th>
              <th style={styles.headerCellStyle}>Village Output (units/s)</th>
            </tr>
          </thead>
          <tbody>{renderTroopRows(tier1Troops)}</tbody>
        </table>
      </div>

      {/* Tier 2 Troops */}
      {tier2Troops.length > 0 && (
        <>
          <div style={{ ...styles.subtitleStyle, fontSize: "0.9rem", marginTop: "1.5rem" }}>Tier 2 Troops</div>
          <div style={styles.tableWrapperStyle}>
            <table style={styles.tableStyle}>
              <thead>
                <tr>
                  <th style={styles.headerCellStyle}>Troop</th>
                  <th style={{ ...styles.headerCellStyle, width: "50%", minWidth: "300px" }}>
                    Input Materials (units/s)
                  </th>
                  <th style={styles.headerCellStyle}>Realm Output (units/s)</th>
                  <th style={styles.headerCellStyle}>Village Output (units/s)</th>
                </tr>
              </thead>
              <tbody>{renderTroopRows(tier2Troops)}</tbody>
            </table>
          </div>
        </>
      )}

      {/* Tier 3 Troops */}
      {tier3Troops.length > 0 && (
        <>
          <div style={{ ...styles.subtitleStyle, fontSize: "0.9rem", marginTop: "1.5rem" }}>Tier 3 Troops</div>
          <div style={styles.tableWrapperStyle}>
            <table style={styles.tableStyle}>
              <thead>
                <tr>
                  <th style={styles.headerCellStyle}>Troop</th>
                  <th style={{ ...styles.headerCellStyle, width: "50%", minWidth: "300px" }}>
                    Input Materials (units/s)
                  </th>
                  <th style={styles.headerCellStyle}>Realm Output (units/s)</th>
                  <th style={styles.headerCellStyle}>Village Output (units/s)</th>
                </tr>
              </thead>
              <tbody>{renderTroopRows(tier3Troops)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// Component for Labor Production
export const LaborProduction = () => {
  const config = ETERNUM_CONFIG();
  const laborOutputPerResource = config.resources?.laborOutputPerResource || {};

  const laborOutputPerSecond = config.resources?.productionByComplexRecipeOutputs?.[ResourcesIds.Labor] || 0;

  // Get resources that produce labor
  const laborProducingResources = Object.keys(laborOutputPerResource)
    .map(Number)
    .filter((id) => laborOutputPerResource[id] > 0)
    .sort((a, b) => {
      // Sort by resource rarity (if available)
      const rarityA = RESOURCE_RARITY[a] || 0;
      const rarityB = RESOURCE_RARITY[b] || 0;
      return rarityA - rarityB;
    });

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Labor Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Realm Output (units/s)</th>
              <th style={styles.headerCellStyle}>Village Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {laborProducingResources.map((resourceId) => {
              const resourceName = getResourceName(resourceId);
              const resourceInput = laborOutputPerResource[resourceId]
                ? laborOutputPerSecond / laborOutputPerResource[resourceId]
                : 0;

              return (
                <tr key={`labor-${resourceId}`}>
                  <td style={styles.resourceCellStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {resourceName}
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {formatAmount(resourceInput)}
                    </div>
                  </td>
                  <td style={styles.productionCellStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={ResourcesIds.Labor} name="Labor" size="md" />
                      {formatAmount(laborOutputPerSecond)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const DonkeyProduction = () => {
  const config = ETERNUM_CONFIG();
  const donkeyOutput = config.resources?.productionBySimpleRecipeOutputs?.[ResourcesIds.Donkey] || 0;
  const donkeyInputs = config.resources?.productionByComplexRecipe?.[ResourcesIds.Donkey] || [];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Donkey Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Realm Output (units/s)</th>
              <th style={styles.headerCellStyle}>Village Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.resourceCellStyle}>
                <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />
                Donkey
              </td>
              <td style={styles.productionCellStyle}>
                <div style={styles.resourceGroupStyle}>
                  {donkeyInputs.map((input, idx) => (
                    <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                      <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="md" />
                      {formatAmount(input.amount)}
                    </div>
                  ))}
                </div>
              </td>
              <td style={styles.productionCellStyle}>
                <div style={styles.resourceItemStyle}>
                  <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />
                  {formatAmount(donkeyOutput)}/s
                </div>
              </td>
              <td style={styles.productionCellStyle}>
                <div style={styles.resourceItemStyle}>
                  <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />
                  {formatAmount(donkeyOutput)}/s
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component for Blitz Standard Mode Resource Production (Hardcoded)
export const BlitzStandardResourceProduction = () => {
  // Hardcoded data for Blitz standard mode
  const blitzStandardResources = [
    {
      id: ResourcesIds.Wood,
      name: "Wood",
      wheat: 1,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.2, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.2, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Coal,
      name: "Coal",
      wheat: 1,
      inputs: [
        { resource: ResourcesIds.Wood, amount: 0.36, name: "Wood" },
        { resource: ResourcesIds.Copper, amount: 0.24, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Copper,
      name: "Copper",
      wheat: 1,
      inputs: [
        { resource: ResourcesIds.Wood, amount: 0.36, name: "Wood" },
        { resource: ResourcesIds.Coal, amount: 0.24, name: "Coal" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Ironwood,
      name: "Ironwood",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.48, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.32, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.ColdIron,
      name: "Cold Iron",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.48, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.32, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Gold,
      name: "Gold",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.48, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.32, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Adamantine,
      name: "Adamantine",
      wheat: 4,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Ironwood, amount: 0.4, name: "Ironwood" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Mithral,
      name: "Mithral",
      wheat: 4,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.ColdIron, amount: 0.4, name: "Cold Iron" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Dragonhide,
      name: "Dragonhide",
      wheat: 4,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Gold, amount: 0.4, name: "Gold" },
      ],
      output: 1,
    },
  ];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Standard Mode Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzStandardResources.map((resource) => (
              <tr key={`blitz-standard-${resource.id}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={resource.id} name={resource.name} size="md" />
                  {resource.name}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceGroupStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={ResourcesIds.Wheat} name="Wheat" size="md" />
                      {resource.wheat}
                    </div>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={resource.inputs[0].resource} name={resource.inputs[0].name} size="md" />
                      {resource.inputs[0].amount}
                    </div>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={resource.inputs[1].resource} name={resource.inputs[1].name} size="md" />
                      {resource.inputs[1].amount}
                    </div>
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resource.id} name={resource.name} size="md" />
                    {resource.output}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={componentStyles.tableFootnoteStyle}>
        {/* DRAFTING NOTE: Hardcoded table for Blitz standard mode - replace with dynamic data when config is updated */}
      </div>
    </div>
  );
};

// Component for Blitz Labor Production (Hardcoded)
export const BlitzLaborProduction = () => {
  // Hardcoded data for Blitz labor production
  const blitzLaborResources = [
    { id: ResourcesIds.Wood, name: "Wood", input: 10, output: 10 },
    { id: ResourcesIds.Coal, name: "Coal", input: 5, output: 10 },
    { id: ResourcesIds.Copper, name: "Copper", input: 5, output: 10 },
    { id: ResourcesIds.Ironwood, name: "Ironwood", input: 2, output: 10 },
    { id: ResourcesIds.ColdIron, name: "Cold Iron", input: 2, output: 10 },
    { id: ResourcesIds.Gold, name: "Gold", input: 2, output: 10 },
    { id: ResourcesIds.Adamantine, name: "Adamantine", input: 0.5, output: 10 },
    { id: ResourcesIds.Mithral, name: "Mithral", input: 0.5, output: 10 },
    { id: ResourcesIds.Dragonhide, name: "Dragonhide", input: 0.5, output: 10 },
  ];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Labor Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input (units/s)</th>
              <th style={styles.headerCellStyle}>Labor Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzLaborResources.map((resource) => (
              <tr key={`blitz-labor-${resource.id}`}>
                <td style={styles.resourceCellStyle}>
                  <div style={{ minWidth: "24px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                    <ResourceIcon id={resource.id} name={resource.name} size="md" />
                  </div>
                  {resource.name}
                </td>
                <td style={styles.productionCellStyle}>{resource.input}</td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <div style={{ minWidth: "20px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                      <ResourceIcon id={ResourcesIds.Labor} name="Labor" size="md" />
                    </div>
                    {resource.output}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={componentStyles.tableFootnoteStyle}>
        {/* DRAFTING NOTE: Hardcoded table for Blitz labor production - replace with dynamic data when config is updated */}
      </div>
    </div>
  );
};

// Component for Blitz Simple Troop Production (Hardcoded)
export const BlitzSimpleTroopProduction = () => {
  // Hardcoded data for Blitz simple troop production
  const blitzSimpleTroops = [
    { id: ResourcesIds.Knight, name: "T1 Knight", wheat: 2, labor: 0.5, output: 5 },
    { id: ResourcesIds.Crossbowman, name: "T1 Crossbowman", wheat: 2, labor: 0.5, output: 5 },
    { id: ResourcesIds.Paladin, name: "T1 Paladin", wheat: 2, labor: 0.5, output: 5 },
  ];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Simple Troop Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Troop Type</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzSimpleTroops.map((troop) => (
              <tr key={`blitz-simple-troop-${troop.id}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={troop.id} name={troop.name} size="md" />
                  {troop.name}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceGroupStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={ResourcesIds.Wheat} name="Wheat" size="md" />
                      {troop.wheat}
                    </div>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={ResourcesIds.Labor} name="Labor" size="md" />
                      {troop.labor}
                    </div>
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={troop.id} name={troop.name} size="md" />
                    {troop.output}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={componentStyles.tableFootnoteStyle}>
        {/* DRAFTING NOTE: Hardcoded table for Blitz simple troop production - replace with dynamic data when config is updated */}
      </div>
    </div>
  );
};

// Component for Blitz Standard Troop Production (Hardcoded)
export const BlitzStandardTroopProduction = () => {
  // Hardcoded data for Blitz standard troop production
  const blitzStandardTroops = [
    // T1
    {
      id: ResourcesIds.Knight,
      name: "T1 Knight",
      wheat: 2,
      troopInput: null,
      troopInputRate: null,
      inputs: [{ resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" }],
      output: 5,
    },
    {
      id: ResourcesIds.Crossbowman,
      name: "T1 Crossbowman",
      wheat: 2,
      troopInput: null,
      troopInputRate: null,
      inputs: [{ resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" }],
      output: 5,
    },
    {
      id: ResourcesIds.Paladin,
      name: "T1 Paladin",
      wheat: 2,
      troopInput: null,
      troopInputRate: null,
      inputs: [{ resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" }],
      output: 5,
    },
    // T2
    {
      id: ResourcesIds.KnightT2,
      name: "T2 Knight",
      wheat: 3,
      troopInput: ResourcesIds.Knight,
      troopInputRate: 10,
      inputs: [
        { resource: ResourcesIds.Copper, amount: 0.2, name: "Copper" },
        { resource: ResourcesIds.ColdIron, amount: 0.4, name: "Cold Iron" },
        { resource: ResourcesIds.Essence, amount: 1, name: "Essence" },
      ],
      output: 5,
    },
    {
      id: ResourcesIds.CrossbowmanT2,
      name: "T2 Crossbowman",
      wheat: 3,
      troopInput: ResourcesIds.Crossbowman,
      troopInputRate: 10,
      inputs: [
        { resource: ResourcesIds.Copper, amount: 0.2, name: "Copper" },
        { resource: ResourcesIds.Ironwood, amount: 0.4, name: "Ironwood" },
        { resource: ResourcesIds.Essence, amount: 1, name: "Essence" },
      ],
      output: 5,
    },
    {
      id: ResourcesIds.PaladinT2,
      name: "T2 Paladin",
      wheat: 3,
      troopInput: ResourcesIds.Paladin,
      troopInputRate: 10,
      inputs: [
        { resource: ResourcesIds.Copper, amount: 0.2, name: "Copper" },
        { resource: ResourcesIds.Gold, amount: 0.4, name: "Gold" },
        { resource: ResourcesIds.Essence, amount: 1, name: "Essence" },
      ],
      output: 5,
    },
    // T3
    {
      id: ResourcesIds.KnightT3,
      name: "T3 Knight",
      wheat: 4,
      troopInput: ResourcesIds.KnightT2,
      troopInputRate: 10,
      inputs: [
        { resource: ResourcesIds.ColdIron, amount: 0.2, name: "Cold Iron" },
        { resource: ResourcesIds.Mithral, amount: 0.6, name: "Mithral" },
        { resource: ResourcesIds.Essence, amount: 3, name: "Essence" },
      ],
      output: 5,
    },
    {
      id: ResourcesIds.CrossbowmanT3,
      name: "T3 Crossbowman",
      wheat: 4,
      troopInput: ResourcesIds.CrossbowmanT2,
      troopInputRate: 10,
      inputs: [
        { resource: ResourcesIds.Ironwood, amount: 0.2, name: "Ironwood" },
        { resource: ResourcesIds.Adamantine, amount: 0.6, name: "Adamantine" },
        { resource: ResourcesIds.Essence, amount: 3, name: "Essence" },
      ],
      output: 5,
    },
    {
      id: ResourcesIds.PaladinT3,
      name: "T3 Paladin",
      wheat: 4,
      troopInput: ResourcesIds.PaladinT2,
      troopInputRate: 10,
      inputs: [
        { resource: ResourcesIds.Gold, amount: 0.2, name: "Gold" },
        { resource: ResourcesIds.Dragonhide, amount: 0.6, name: "Dragonhide" },
        { resource: ResourcesIds.Essence, amount: 3, name: "Essence" },
      ],
      output: 5,
    },
  ];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Standard Troop Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Troop Type</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzStandardTroops.map((troop) => (
              <tr key={`blitz-standard-troop-${troop.id}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={troop.id} name={troop.name} size="md" />
                  {troop.name}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceGroupStyle}>
                    <div style={styles.resourceItemStyle}>
                      <ResourceIcon id={ResourcesIds.Wheat} name="Wheat" size="md" />
                      {troop.wheat}
                    </div>
                    {troop.troopInput && (
                      <div style={styles.resourceItemStyle}>
                        <ResourceIcon
                          id={troop.troopInput}
                          name={blitzStandardTroops.find((t) => t.id === troop.troopInput)?.name || "Troop"}
                          size="md"
                        />
                        {troop.troopInputRate}
                      </div>
                    )}
                    {troop.inputs.map((input, idx) => (
                      <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                        <ResourceIcon id={input.resource} name={input.name} size="md" />
                        {input.amount}
                      </div>
                    ))}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={troop.id} name={troop.name} size="md" />
                    {troop.output}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={componentStyles.tableFootnoteStyle}>
        {/* DRAFTING NOTE: Hardcoded table for Blitz standard troop production - replace with dynamic data when config is updated. Essence icon is a placeholder. */}
      </div>
    </div>
  );
};

// Component for Blitz Donkey Production (Hardcoded)
export const BlitzDonkeyProduction = () => {
  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Donkey Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.headerCellStyle}>Resource</th>
              <th style={styles.headerCellStyle}>Input Materials (units/s)</th>
              <th style={styles.headerCellStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.resourceCellStyle}>
                <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />
                Donkey
              </td>
              <td style={styles.productionCellStyle}>
                <div style={styles.resourceGroupStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={ResourcesIds.Wheat} name="Wheat" size="md" />3
                  </div>
                </div>
              </td>
              <td style={styles.productionCellStyle}>
                <div style={styles.resourceItemStyle}>
                  <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />
                  0.1
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={componentStyles.tableFootnoteStyle}>
        {/* DRAFTING NOTE: Hardcoded table for Blitz donkey production - replace with dynamic data when config is updated */}
      </div>
    </div>
  );
};
