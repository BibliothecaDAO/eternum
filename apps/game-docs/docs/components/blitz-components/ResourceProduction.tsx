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
    overflowX: "hidden" as const,
  },
  headerCellStyle: table.headerCell,
  // Blitz 3-column layout
  blitzResourceHeaderStyle: { ...table.headerCell, width: "22%", whiteSpace: "nowrap" as const },
  blitzInputHeaderStyle: { ...table.headerCell, width: "57%", whiteSpace: "nowrap" as const },
  blitzOutputHeaderStyle: { ...table.headerCell, width: "21%", whiteSpace: "nowrap" as const },
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

// Component for Blitz Standard Mode Resource Production (Hardcoded)
export const BlitzStandardResourceProduction = () => {
  // Hardcoded data for Blitz standard mode (Series 0: output doubled to 2/s, resource/wheat inputs unchanged)
  const blitzStandardResources = [
    {
      id: ResourcesIds.Wood,
      name: "Wood",
      wheat: 1,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.2, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.2, name: "Copper" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.Coal,
      name: "Coal",
      wheat: 1,
      inputs: [
        { resource: ResourcesIds.Wood, amount: 0.3, name: "Wood" },
        { resource: ResourcesIds.Copper, amount: 0.2, name: "Copper" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.Copper,
      name: "Copper",
      wheat: 1,
      inputs: [
        { resource: ResourcesIds.Wood, amount: 0.3, name: "Wood" },
        { resource: ResourcesIds.Coal, amount: 0.2, name: "Coal" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.Ironwood,
      name: "Ironwood",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.ColdIron,
      name: "Cold Iron",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.Gold,
      name: "Gold",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.Adamantine,
      name: "Adamantine",
      wheat: 3,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.9, name: "Coal" },
        { resource: ResourcesIds.Ironwood, amount: 0.6, name: "Ironwood" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.Mithral,
      name: "Mithral",
      wheat: 3,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.9, name: "Coal" },
        { resource: ResourcesIds.ColdIron, amount: 0.6, name: "Cold Iron" },
      ],
      output: 2,
    },
    {
      id: ResourcesIds.Dragonhide,
      name: "Dragonhide",
      wheat: 3,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.9, name: "Coal" },
        { resource: ResourcesIds.Gold, amount: 0.6, name: "Gold" },
      ],
      output: 2,
    },
  ];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Standard Mode Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.blitzResourceHeaderStyle}>Resource</th>
              <th style={styles.blitzInputHeaderStyle}>Input Materials (units/s)</th>
              <th style={styles.blitzOutputHeaderStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzStandardResources.map((resource) => (
              <tr key={`blitz-standard-${resource.id}`}>
                <td style={styles.resourceCellStyle}>
                  <div style={styles.resourceCellInner}>
                    <ResourceIcon id={resource.id} name={resource.name} size="md" />
                    {resource.name}
                  </div>
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

// Component for Blitz Standard Troop Production (Hardcoded)
export const BlitzStandardTroopProduction = () => {
  // Hardcoded data for Blitz standard troop production (Series 0: resource/labor costs doubled, output doubled, wheat/essence unchanged)
  const blitzStandardTroops = [
    // T1
    {
      id: ResourcesIds.Knight,
      name: "T1 Knight",
      wheat: 2,
      troopInput: null,
      troopInputRate: null,
      inputs: [{ resource: ResourcesIds.Copper, amount: 0.8, name: "Copper" }],
      output: 10,
    },
    {
      id: ResourcesIds.Crossbowman,
      name: "T1 Crossbowman",
      wheat: 2,
      troopInput: null,
      troopInputRate: null,
      inputs: [{ resource: ResourcesIds.Copper, amount: 0.8, name: "Copper" }],
      output: 10,
    },
    {
      id: ResourcesIds.Paladin,
      name: "T1 Paladin",
      wheat: 2,
      troopInput: null,
      troopInputRate: null,
      inputs: [{ resource: ResourcesIds.Copper, amount: 0.8, name: "Copper" }],
      output: 10,
    },
    // T2
    {
      id: ResourcesIds.KnightT2,
      name: "T2 Knight",
      wheat: 3,
      troopInput: ResourcesIds.Knight,
      troopInputRate: 20,
      inputs: [
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
        { resource: ResourcesIds.ColdIron, amount: 1.2, name: "Cold Iron" },
        { resource: ResourcesIds.Essence, amount: 1, name: "Essence" },
      ],
      output: 10,
    },
    {
      id: ResourcesIds.CrossbowmanT2,
      name: "T2 Crossbowman",
      wheat: 3,
      troopInput: ResourcesIds.Crossbowman,
      troopInputRate: 20,
      inputs: [
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
        { resource: ResourcesIds.Ironwood, amount: 1.2, name: "Ironwood" },
        { resource: ResourcesIds.Essence, amount: 1, name: "Essence" },
      ],
      output: 10,
    },
    {
      id: ResourcesIds.PaladinT2,
      name: "T2 Paladin",
      wheat: 3,
      troopInput: ResourcesIds.Paladin,
      troopInputRate: 20,
      inputs: [
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
        { resource: ResourcesIds.Gold, amount: 1.2, name: "Gold" },
        { resource: ResourcesIds.Essence, amount: 1, name: "Essence" },
      ],
      output: 10,
    },
    // T3
    {
      id: ResourcesIds.KnightT3,
      name: "T3 Knight",
      wheat: 4,
      troopInput: ResourcesIds.KnightT2,
      troopInputRate: 20,
      inputs: [
        { resource: ResourcesIds.ColdIron, amount: 0.8, name: "Cold Iron" },
        { resource: ResourcesIds.Mithral, amount: 1.6, name: "Mithral" },
        { resource: ResourcesIds.Essence, amount: 3, name: "Essence" },
      ],
      output: 10,
    },
    {
      id: ResourcesIds.CrossbowmanT3,
      name: "T3 Crossbowman",
      wheat: 4,
      troopInput: ResourcesIds.CrossbowmanT2,
      troopInputRate: 20,
      inputs: [
        { resource: ResourcesIds.Ironwood, amount: 0.8, name: "Ironwood" },
        { resource: ResourcesIds.Adamantine, amount: 1.6, name: "Adamantine" },
        { resource: ResourcesIds.Essence, amount: 3, name: "Essence" },
      ],
      output: 10,
    },
    {
      id: ResourcesIds.PaladinT3,
      name: "T3 Paladin",
      wheat: 4,
      troopInput: ResourcesIds.PaladinT2,
      troopInputRate: 20,
      inputs: [
        { resource: ResourcesIds.Gold, amount: 0.8, name: "Gold" },
        { resource: ResourcesIds.Dragonhide, amount: 1.6, name: "Dragonhide" },
        { resource: ResourcesIds.Essence, amount: 3, name: "Essence" },
      ],
      output: 10,
    },
  ];

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.subtitleStyle}>Standard Troop Production</div>
      <div style={styles.tableWrapperStyle}>
        <table style={styles.tableStyle}>
          <thead>
            <tr>
              <th style={styles.blitzResourceHeaderStyle}>Troop Type</th>
              <th style={styles.blitzInputHeaderStyle}>Input Materials (units/s)</th>
              <th style={styles.blitzOutputHeaderStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzStandardTroops.map((troop) => (
              <tr key={`blitz-standard-troop-${troop.id}`}>
                <td style={styles.resourceCellStyle}>
                  <div style={styles.resourceCellInner}>
                    <ResourceIcon id={troop.id} name={troop.name} size="md" />
                    {troop.name}
                  </div>
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
              <th style={styles.blitzResourceHeaderStyle}>Resource</th>
              <th style={styles.blitzInputHeaderStyle}>Input Materials (units/s)</th>
              <th style={styles.blitzOutputHeaderStyle}>Output (units/s)</th>
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
                  <div style={styles.resourceItemStyle}>
                    <ResourceIcon id={ResourcesIds.Wheat} name="Wheat" size="md" />3
                  </div>
                </div>
              </td>
              <td style={styles.productionCellStyle}>
                <div style={styles.resourceItemStyle}>
                  <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />5
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
