import { ETERNUM_CONFIG } from "@/utils/config";
import { resources, ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "../ResourceIcon";
import { colors, formatAmount, section, table } from "../styles";

export const RESOURCES: ResourcesIds[] = [
  ResourcesIds.Wood,
  ResourcesIds.Stone,
  ResourcesIds.Coal,
  ResourcesIds.Copper,
  ResourcesIds.Obsidian,
  ResourcesIds.Silver,
  ResourcesIds.Ironwood,
  ResourcesIds.ColdIron,
  ResourcesIds.Gold,
  ResourcesIds.Hartwood,
  ResourcesIds.Diamonds,
  ResourcesIds.Sapphire,
  ResourcesIds.Ruby,
  ResourcesIds.DeepCrystal,
  ResourcesIds.Ignium,
  ResourcesIds.EtherealSilica,
  ResourcesIds.TrueIce,
  ResourcesIds.TwilightQuartz,
  ResourcesIds.AlchemicalSilver,
  ResourcesIds.Adamantine,
  ResourcesIds.Mithral,
  ResourcesIds.Dragonhide,
];

export const TROOPS = [
  ResourcesIds.Knight,
  ResourcesIds.KnightT2,
  ResourcesIds.KnightT3,
  ResourcesIds.Crossbowman,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.CrossbowmanT3,
  ResourcesIds.Paladin,
  ResourcesIds.PaladinT2,
  ResourcesIds.PaladinT3,
];

export const SPECIAL_RESOURCES = [ResourcesIds.AncientFragment, ResourcesIds.Labor];

export const TRANSPORT_RESOURCES = [ResourcesIds.Donkey];

export const FOOD_RESOURCES = [ResourcesIds.Wheat, ResourcesIds.Fish];

export const TOKENS = [ResourcesIds.Lords];

// Resource groups for display
export const RESOURCE_GROUPS = [
  {
    name: "Resources",
    resources: RESOURCES,
  },
  { name: "Food", resources: FOOD_RESOURCES },
  { name: "Special", resources: SPECIAL_RESOURCES },
  { name: "Transport", resources: TRANSPORT_RESOURCES },
  { name: "Military Units", resources: TROOPS },
  { name: "Tokens", resources: TOKENS },
];

// Helper function to get resource name
const getResourceName = (id: number): string => {
  return resources.find((r) => r.id === Number(id))?.trait || `Resource ${id}`;
};

// Function to get color based on group
const getGroupColor = (groupName: string): string => {
  switch (groupName) {
    case "Food":
      return colors.secondary;
    case "Special":
    case "Tokens":
      return colors.arcane;
    case "Resources":
      return colors.primary;
    case "Transport":
    case "Military Units":
      return colors.borderDark;
    default:
      return colors.primary;
  }
};

// Component styles
const componentStyles = {
  resourcesGroupStyle: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.5rem",
    alignItems: "center",
  },
  resourceItemStyle: {
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    padding: "0.25rem 0.5rem",
    backgroundColor: colors.background.dark,
    borderRadius: "0.35rem",
    fontSize: "0.75rem",
    whiteSpace: "nowrap" as const,
    minWidth: "fit-content",
    border: `1px solid ${colors.border}`,
  },
  weightStyle: {
    marginLeft: "auto",
    color: colors.text.muted,
    fontSize: "0.7rem",
    fontWeight: 500,
  },
  categoryHeaderStyle: {
    ...table.cell,
    color: colors.text.light,
    fontWeight: 500,
    padding: "0.75rem 0.5rem",
    whiteSpace: "nowrap" as const,
  },
};

export const BlitzWeightTable = () => {
  // Hardcoded weights for the 9 Blitz resources (in kg)
  const blitzResources = [
    { id: ResourcesIds.Wood, name: "Wood", weight: 1 },
    { id: ResourcesIds.Coal, name: "Coal", weight: 1 },
    { id: ResourcesIds.Copper, name: "Copper", weight: 1 },
    { id: ResourcesIds.Ironwood, name: "Ironwood", weight: 1 },
    { id: ResourcesIds.ColdIron, name: "Cold Iron", weight: 1 },
    { id: ResourcesIds.Gold, name: "Gold", weight: 1 },
    { id: ResourcesIds.Adamantine, name: "Adamantine", weight: 1 },
    { id: ResourcesIds.Mithral, name: "Mithral", weight: 1 },
    { id: ResourcesIds.Dragonhide, name: "Dragonhide", weight: 1 },
  ];

  // Wheat (Food)
  const foodResources = [{ id: ResourcesIds.Wheat, name: "Wheat", weight: 0.1 }];

  // Donkey (Transport)
  const transportResources = [{ id: ResourcesIds.Donkey, name: "Donkey", weight: 0 }];

  // Troops (Military Units)
  const troopResources = [
    { id: ResourcesIds.Knight, name: "T1 Knight", weight: 5 },
    { id: ResourcesIds.KnightT2, name: "T2 Knight", weight: 5 },
    { id: ResourcesIds.KnightT3, name: "T3 Knight", weight: 5 },
    { id: ResourcesIds.Crossbowman, name: "T1 Crossbowman", weight: 5 },
    { id: ResourcesIds.CrossbowmanT2, name: "T2 Crossbowman", weight: 5 },
    { id: ResourcesIds.CrossbowmanT3, name: "T3 Crossbowman", weight: 5 },
    { id: ResourcesIds.Paladin, name: "T1 Paladin", weight: 5 },
    { id: ResourcesIds.PaladinT2, name: "T2 Paladin", weight: 5 },
    { id: ResourcesIds.PaladinT3, name: "T3 Paladin", weight: 5 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Material Weights</div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Category</th>
              <th style={table.headerCell}>Resources</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={componentStyles.categoryHeaderStyle}>Resources</td>
              <td style={table.cell}>
                <div style={componentStyles.resourcesGroupStyle}>
                  {blitzResources.map((resource) => (
                    <div key={resource.id} style={componentStyles.resourceItemStyle}>
                      <ResourceIcon id={resource.id} name={resource.name} size="md" />
                      <span style={{ color: colors.text.light }}>{resource.name}</span>
                      <span style={componentStyles.weightStyle}>{resource.weight.toFixed(1)} kg</span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <td style={componentStyles.categoryHeaderStyle}>Food</td>
              <td style={table.cell}>
                <div style={componentStyles.resourcesGroupStyle}>
                  {foodResources.map((resource) => (
                    <div key={resource.id} style={componentStyles.resourceItemStyle}>
                      <ResourceIcon id={resource.id} name={resource.name} size="md" />
                      <span style={{ color: colors.text.light }}>{resource.name}</span>
                      <span style={componentStyles.weightStyle}>{resource.weight.toFixed(1)} kg</span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <td style={componentStyles.categoryHeaderStyle}>Transport</td>
              <td style={table.cell}>
                <div style={componentStyles.resourcesGroupStyle}>
                  {transportResources.map((resource) => (
                    <div key={resource.id} style={componentStyles.resourceItemStyle}>
                      <ResourceIcon id={resource.id} name={resource.name} size="md" />
                      <span style={{ color: colors.text.light }}>{resource.name}</span>
                      <span style={componentStyles.weightStyle}>{resource.weight.toFixed(1)} kg</span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <td style={componentStyles.categoryHeaderStyle}>Military Units</td>
              <td style={table.cell}>
                <div style={componentStyles.resourcesGroupStyle}>
                  {troopResources.map((resource) => (
                    <div key={resource.id} style={componentStyles.resourceItemStyle}>
                      <ResourceIcon id={resource.id} name={resource.name} size="md" />
                      <span style={{ color: colors.text.light }}>{resource.name}</span>
                      <span style={componentStyles.weightStyle}>{resource.weight.toFixed(1)} kg</span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <td style={componentStyles.categoryHeaderStyle}>Special</td>
              <td style={table.cell}>
                <div style={componentStyles.resourcesGroupStyle}>
                  <div key={ResourcesIds.Essence} style={componentStyles.resourceItemStyle}>
                    <ResourceIcon id={ResourcesIds.Essence} name="Essence" size="md" />
                    <span style={{ color: colors.text.light }}>Essence</span>
                    <span style={componentStyles.weightStyle}>0.1 kg</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={componentStyles.weightStyle}>
        {/* DRAFTING NOTE: Hardcoded table for Blitz mode - replace with dynamic data when config is updated. Essence icon is a placeholder. */}
      </div>
    </div>
  );
};
