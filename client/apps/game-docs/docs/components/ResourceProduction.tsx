import { ETERNUM_CONFIG } from "@/utils/config";
import { RESOURCE_RARITY, ResourcesIds, resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, section, table } from "./styles";

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
    padding: "0.8rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  productionCellStyle: {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
    color: "#dfc296",
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
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1rem",
    marginTop: "1rem",
    marginBottom: "1rem",
    "@media (min-width: 640px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
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
  const resourceInputSimpleMode = config.resources.productionBySimpleRecipe;
  const resourceOutputSimpleMode = config.resources.productionBySimpleRecipeOutputs;

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
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Input Resources</th>
            <th style={styles.headerCellStyle}>Realm Output</th>
            <th style={styles.headerCellStyle}>Village Output</th>
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
                    {resourceInputSimpleMode[resourceId].map((input, idx) => (
                      <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                        <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="md" />
                        {formatAmount(input.amount)}/s
                      </div>
                    ))}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {formatAmount(realmOutputAmount)}/s
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {formatAmount(villageOutputAmount)}/s
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Component for Complex Mode Resource Production
export const StandardResourceProduction = () => {
  const config = ETERNUM_CONFIG();
  const resourceInputComplexMode = config.resources.productionByComplexRecipe;
  const resourceOutputComplexMode = config.resources.productionByComplexRecipeOutputs;

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
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Input Resources</th>
            <th style={styles.headerCellStyle}>Realm Output</th>
            <th style={styles.headerCellStyle}>Village Output</th>
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
                    {resourceInputComplexMode[resourceId].map((input, idx) => (
                      <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                        <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="md" />
                        {formatAmount(input.amount)}/s
                      </div>
                    ))}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {formatAmount(realmOutputAmount)}/s
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    {formatAmount(villageOutputAmount)}/s
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Component for Simple Mode Troop Production
export const SimpleTroopProduction = () => {
  const config = ETERNUM_CONFIG();
  const troopInputSimpleMode = config.resources.productionBySimpleRecipe;
  const troopOutputSimpleMode = config.resources.productionBySimpleRecipeOutputs;

  // Get all troop IDs with production data for simple mode
  const simpleTroopIds = Object.keys(troopInputSimpleMode)
    .map(Number)
    .filter((id) => troopInputSimpleMode[id]?.length > 0)
    .filter((id) => isMilitary(id))
    .sort((a, b) => a - b);

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Simple Mode Troop Production</div>
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
                    {troopInputSimpleMode[troopId].map((input, idx) => (
                      <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                        <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="md" />
                        {formatAmount(input.amount)}/s
                      </div>
                    ))}
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={troopId} name={troopName} size="md" />
                    {formatAmount(realmOutputAmount)}/s
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={troopId} name={troopName} size="md" />
                    {formatAmount(villageOutputAmount)}/s
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Component for Standard Mode Troop Production
export const StandardTroopProduction = () => {
  const config = ETERNUM_CONFIG();
  const troopInputComplexMode = config.resources.productionByComplexRecipe;
  const troopOutputComplexMode = config.resources.productionByComplexRecipeOutputs;

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
  const renderTroopRows = (troopIds) => {
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
              {troopInputComplexMode[troopId].map((input, idx) => (
                <div key={`${input.resource}-${idx}`} style={styles.resourceItemStyle}>
                  <ResourceIcon id={input.resource} name={getResourceName(input.resource)} size="sm" />
                  {formatAmount(input.amount)}/s
                </div>
              ))}
            </div>
          </td>
          <td style={styles.productionCellStyle}>
            <div style={styles.resourceItemStyle}>
              <ResourceIcon id={troopId} name={troopName} size="sm" />
              {formatAmount(realmOutputAmount)}/s
            </div>
          </td>
          <td style={styles.productionCellStyle}>
            <div style={styles.resourceItemStyle}>
              <ResourceIcon id={troopId} name={troopName} size="sm" />
              {formatAmount(villageOutputAmount)}/s
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
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Troop</th>
            <th style={{ ...styles.headerCellStyle, width: "50%", minWidth: "300px" }}>Input Resources</th>
            <th style={styles.headerCellStyle}>Realm Output</th>
            <th style={styles.headerCellStyle}>Village Output</th>
          </tr>
        </thead>
        <tbody>{renderTroopRows(tier1Troops)}</tbody>
      </table>

      {/* Tier 2 Troops */}
      {tier2Troops.length > 0 && (
        <>
          <div style={{ ...styles.subtitleStyle, fontSize: "0.9rem", marginTop: "1.5rem" }}>Tier 2 Troops</div>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.headerCellStyle}>Troop</th>
                <th style={{ ...styles.headerCellStyle, width: "50%", minWidth: "300px" }}>Input Resources</th>
                <th style={styles.headerCellStyle}>Realm Output</th>
                <th style={styles.headerCellStyle}>Village Output</th>
              </tr>
            </thead>
            <tbody>{renderTroopRows(tier2Troops)}</tbody>
          </table>
        </>
      )}

      {/* Tier 3 Troops */}
      {tier3Troops.length > 0 && (
        <>
          <div style={{ ...styles.subtitleStyle, fontSize: "0.9rem", marginTop: "1.5rem" }}>Tier 3 Troops</div>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.headerCellStyle}>Troop</th>
                <th style={{ ...styles.headerCellStyle, width: "50%", minWidth: "300px" }}>Input Resources</th>
                <th style={styles.headerCellStyle}>Realm Output</th>
                <th style={styles.headerCellStyle}>Village Output</th>
              </tr>
            </thead>
            <tbody>{renderTroopRows(tier3Troops)}</tbody>
          </table>
        </>
      )}
    </div>
  );
};

// Component for Labor Production
export const LaborProduction = () => {
  const config = ETERNUM_CONFIG();
  const laborOutputPerResource = config.resources.laborOutputPerResource;

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
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Input</th>
            <th style={styles.headerCellStyle}>Labor Output</th>
          </tr>
        </thead>
        <tbody>
          {laborProducingResources.map((resourceId) => {
            const resourceName = getResourceName(resourceId);
            const laborOutput = laborOutputPerResource[resourceId] || 0;

            return (
              <tr key={`labor-${resourceId}`}>
                <td style={styles.resourceCellStyle}>
                  <ResourceIcon id={resourceId} name={resourceName} size="md" />
                  {resourceName}
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={resourceId} name={resourceName} size="md" />
                    1/s
                  </div>
                </td>
                <td style={styles.productionCellStyle}>
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={ResourcesIds.Labor} name="Labor" size="md" />
                    {formatAmount(laborOutput)}/s
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const DonkeyProduction = () => {
  const config = ETERNUM_CONFIG();
  const donkeyOutput = config.resources.productionBySimpleRecipeOutputs[ResourcesIds.Donkey];
  const donkeyInputs = config.resources.productionByComplexRecipe[ResourcesIds.Donkey] || [];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Donkey Production</div>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.headerCellStyle}>Resource</th>
            <th style={styles.headerCellStyle}>Input Resources</th>
            <th style={styles.headerCellStyle}>Realm Output</th>
            <th style={styles.headerCellStyle}>Village Output</th>
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
                    {formatAmount(input.amount)}/s
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
  );
};

export default function ResourceProduction() {
  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Resource Production & Consumption</div>

      <div style={componentStyles.infoStyle}>
        Resources are produced and consumed in real-time based on your realm's buildings and infrastructure.
      </div>

      <div style={componentStyles.gridStyle}>
        {/* Food Production Section */}
        <div style={componentStyles.sectionItemStyle}>
          <div style={componentStyles.sectionTitleStyle}>Food Production</div>

          <div style={componentStyles.valueStyle}>
            <span style={componentStyles.labelStyle}>Base production</span>
            <span style={componentStyles.amountStyle}>10 per hour</span>
          </div>

          <div style={componentStyles.valueStyle}>
            <span style={componentStyles.labelStyle}>Farm (level 1)</span>
            <span style={componentStyles.amountStyle}>+5 per hour</span>
          </div>

          <div style={componentStyles.valueStyle}>
            <span style={componentStyles.labelStyle}>Farm (level 2)</span>
            <span style={componentStyles.amountStyle}>+10 per hour</span>
          </div>

          <div style={componentStyles.valueStyle}>
            <span style={componentStyles.labelStyle}>Farm (level 3)</span>
            <span style={componentStyles.amountStyle}>+20 per hour</span>
          </div>
        </div>

        {/* Food Consumption Section */}
        <div style={componentStyles.sectionItemStyle}>
          <div style={componentStyles.sectionTitleStyle}>Food Consumption</div>

          <div style={componentStyles.valueStyle}>
            <span style={componentStyles.labelStyle}>Worker</span>
            <span style={componentStyles.amountStyle}>-2 per hour</span>
          </div>

          <div style={componentStyles.valueStyle}>
            <span style={componentStyles.labelStyle}>Warrior</span>
            <span style={componentStyles.amountStyle}>-5 per hour</span>
          </div>

          <div style={componentStyles.valueStyle}>
            <span style={componentStyles.labelStyle}>Archer</span>
            <span style={componentStyles.amountStyle}>-4 per hour</span>
          </div>

          <div style={componentStyles.buildingRequiredStyle}>* Units will desert if food supplies run out</div>
        </div>
      </div>

      <div style={table.wrapper}>
        <div style={section.subtitle}>Resource Gathering Buildings</div>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Building</th>
              <th style={table.headerCell}>Resource</th>
              <th style={table.headerCell}>Level 1</th>
              <th style={table.headerCell}>Level 2</th>
              <th style={table.headerCell}>Level 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={table.cell}>Farm</td>
              <td style={table.cell}>Food</td>
              <td style={table.cell}>5/hr</td>
              <td style={table.cell}>10/hr</td>
              <td style={table.cell}>20/hr</td>
            </tr>
            <tr>
              <td style={table.cell}>Lumbermill</td>
              <td style={table.cell}>Wood</td>
              <td style={table.cell}>3/hr</td>
              <td style={table.cell}>6/hr</td>
              <td style={table.cell}>12/hr</td>
            </tr>
            <tr>
              <td style={table.cell}>Quarry</td>
              <td style={table.cell}>Stone</td>
              <td style={table.cell}>2/hr</td>
              <td style={table.cell}>4/hr</td>
              <td style={table.cell}>8/hr</td>
            </tr>
            <tr>
              <td style={table.cell}>Mine</td>
              <td style={table.cell}>Ore</td>
              <td style={table.cell}>1/hr</td>
              <td style={table.cell}>3/hr</td>
              <td style={table.cell}>6/hr</td>
            </tr>
          </tbody>
        </table>
        <div style={componentStyles.tableFootnoteStyle}>
          * Resource production is boosted by corresponding realm traits and nearby resources
        </div>
      </div>
    </div>
  );
}
