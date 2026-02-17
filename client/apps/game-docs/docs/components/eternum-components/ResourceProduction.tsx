import { ETERNUM_CONFIG } from "@/utils/config";
import { RESOURCE_RARITY, ResourcesIds, resources } from "@bibliothecadao/types";
import ResourceIcon from "../ResourceIcon";
import { colors, section, table } from "../styles";

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
  sectionStyle: section.wrapper,
  subtitleStyle: section.subtitle,
  tableStyle: {
    ...table.table,
    fontSize: "0.85rem",
  },
  tableWrapperStyle: {
    ...table.container,
    scrollbarWidth: "thin" as const,
  },
  headerCellStyle: table.headerCell,
  cellStyle: table.cell,
  resourceCellStyle: {
    ...table.resourceCell,
    width: "22%",
    minWidth: "unset",
    verticalAlign: "middle" as const,
  },
  resourceCellInner: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "0.35rem",
  },
  productionCellStyle: {
    ...table.cell,
    color: colors.primary,
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
    padding: "0.2rem 0.35rem",
    backgroundColor: colors.background.dark,
    borderRadius: "0.35rem",
    fontSize: "0.75rem",
    whiteSpace: "nowrap" as const,
    minWidth: "fit-content",
    border: `1px solid ${colors.border}`,
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
    .toSorted((a, b) => {
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
                    <div style={styles.resourceCellInner}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {resourceName}
                    </div>
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
    .toSorted((a, b) => {
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
                    <div style={styles.resourceCellInner}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {resourceName}
                    </div>
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
    .toSorted((a, b) => a - b);

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
                    <div style={styles.resourceCellInner}>
                      <ResourceIcon id={troopId} name={troopName} size="md" />
                      {troopName}
                    </div>
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
    .toSorted((a, b) => a - b);

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
            <div style={styles.resourceCellInner}>
              <ResourceIcon id={troopId} name={troopName} size="md" />
              {troopName}
            </div>
          </td>
          <td style={styles.productionCellStyle}>
            <div style={styles.resourceGroupStyle}>
              {(troopInputComplexMode[troopId] || []).map((input, idx) => (
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
              <th style={{ ...styles.headerCellStyle, width: "57%" }}>Input Materials (units/s)</th>
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
                  <th style={{ ...styles.headerCellStyle, width: "57%" }}>Input Materials (units/s)</th>
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
                  <th style={{ ...styles.headerCellStyle, width: "57%" }}>Input Materials (units/s)</th>
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
    .toSorted((a, b) => {
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
                    <div style={styles.resourceCellInner}>
                      <ResourceIcon id={resourceId} name={resourceName} size="md" />
                      {resourceName}
                    </div>
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
                <div style={styles.resourceCellInner}>
                  <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />
                  Donkey
                </div>
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
