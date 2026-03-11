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
              <th style={styles.blitzResourceHeaderStyle}>Resource</th>
              <th style={styles.blitzInputHeaderStyle}>Input Materials (units/s)</th>
              <th style={styles.blitzOutputHeaderStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzResources.map((resource) => (
              <tr key={`blitz-${resource.id}`}>
                <td style={styles.resourceCellStyle}>
                  <div style={styles.resourceCellInner}>
                    <ResourceIcon id={resource.id} name={resource.name} size="md" />
                    {resource.name}
                  </div>
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
        { resource: ResourcesIds.Wood, amount: 0.3, name: "Wood" },
        { resource: ResourcesIds.Copper, amount: 0.2, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Copper,
      name: "Copper",
      wheat: 1,
      inputs: [
        { resource: ResourcesIds.Wood, amount: 0.3, name: "Wood" },
        { resource: ResourcesIds.Coal, amount: 0.2, name: "Coal" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Ironwood,
      name: "Ironwood",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.ColdIron,
      name: "Cold Iron",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Gold,
      name: "Gold",
      wheat: 2,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.6, name: "Coal" },
        { resource: ResourcesIds.Copper, amount: 0.4, name: "Copper" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Adamantine,
      name: "Adamantine",
      wheat: 3,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.9, name: "Coal" },
        { resource: ResourcesIds.Ironwood, amount: 0.6, name: "Ironwood" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Mithral,
      name: "Mithral",
      wheat: 3,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.9, name: "Coal" },
        { resource: ResourcesIds.ColdIron, amount: 0.6, name: "Cold Iron" },
      ],
      output: 1,
    },
    {
      id: ResourcesIds.Dragonhide,
      name: "Dragonhide",
      wheat: 3,
      inputs: [
        { resource: ResourcesIds.Coal, amount: 0.9, name: "Coal" },
        { resource: ResourcesIds.Gold, amount: 0.6, name: "Gold" },
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
              <th style={styles.blitzResourceHeaderStyle}>Resource</th>
              <th style={styles.blitzInputHeaderStyle}>Input (units/s)</th>
              <th style={styles.blitzOutputHeaderStyle}>Labor Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzLaborResources.map((resource) => (
              <tr key={`blitz-labor-${resource.id}`}>
                <td style={styles.resourceCellStyle}>
                  <div style={styles.resourceCellInner}>
                    <div style={{ minWidth: "24px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                      <ResourceIcon id={resource.id} name={resource.name} size="md" />
                    </div>
                    {resource.name}
                  </div>
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
              <th style={styles.blitzResourceHeaderStyle}>Troop Type</th>
              <th style={styles.blitzInputHeaderStyle}>Input Materials (units/s)</th>
              <th style={styles.blitzOutputHeaderStyle}>Output (units/s)</th>
            </tr>
          </thead>
          <tbody>
            {blitzSimpleTroops.map((troop) => (
              <tr key={`blitz-simple-troop-${troop.id}`}>
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
        { resource: ResourcesIds.ColdIron, amount: 0.6, name: "Cold Iron" },
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
        { resource: ResourcesIds.Ironwood, amount: 0.6, name: "Ironwood" },
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
        { resource: ResourcesIds.Gold, amount: 0.6, name: "Gold" },
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
        { resource: ResourcesIds.ColdIron, amount: 0.4, name: "Cold Iron" },
        { resource: ResourcesIds.Mithral, amount: 0.8, name: "Mithral" },
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
        { resource: ResourcesIds.Ironwood, amount: 0.4, name: "Ironwood" },
        { resource: ResourcesIds.Adamantine, amount: 0.8, name: "Adamantine" },
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
        { resource: ResourcesIds.Gold, amount: 0.4, name: "Gold" },
        { resource: ResourcesIds.Dragonhide, amount: 0.8, name: "Dragonhide" },
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
                  <ResourceIcon id={ResourcesIds.Donkey} name="Donkey" size="md" />3
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
