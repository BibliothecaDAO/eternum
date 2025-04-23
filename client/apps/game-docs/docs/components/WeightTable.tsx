import { ETERNUM_CONFIG } from "@/utils/config";
import { resources, ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, formatAmount, section, table } from "./styles";

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
      return "#e5c687"; // pale gold
    case "Special":
    case "Tokens":
      return "#c0c0c0"; // silver
    case "Common Resources":
      return "#aa6c39"; // copper
    case "Uncommon Resources":
      return "#b78d4b"; // tan gold
    case "Rare Resources":
      return "#c19a49"; // bronze gold
    case "Unique Resources":
      return "#d4af37"; // darker gold
    case "Mythic Resources":
      return "#e6be8a"; // light gold
    case "Transport":
    case "Military Units":
      return "#8c7853"; // bronze
    default:
      return "#dfc296"; // default gold
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
    gap: "0.25rem",
    padding: "0.25rem 0.5rem",
    backgroundColor: "rgba(40, 30, 25, 0.6)",
    borderRadius: "0.25rem",
    fontSize: "0.75rem",
  },
  weightStyle: {
    marginLeft: "auto",
    color: colors.text.muted,
    fontSize: "0.7rem",
    fontWeight: 500,
  },
  categoryHeaderStyle: {
    ...table.cell,
    color: colors.secondary,
    fontWeight: 500,
    padding: "0.75rem 0.5rem",
  },
};

export const WeightTable = () => {
  const config = ETERNUM_CONFIG();
  const weights = config.resources.resourceWeightsGrams;

  // Create a lookup map for weights
  const weightMap = new Map<number, number>();
  Object.entries(weights).forEach(([resource, weight]) => {
    weightMap.set(Number(resource), weight);
  });

  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Resource Weights (kg)</div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Category</th>
            <th style={table.headerCell}>Resources</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCE_GROUPS.map((group) => {
            // Skip empty groups
            if (group.resources.length === 0) return null;

            const groupColor = getGroupColor(group.name);

            return (
              <tr key={group.name}>
                <td
                  style={{
                    ...componentStyles.categoryHeaderStyle,
                    borderLeft: `3px solid ${groupColor}`,
                  }}
                >
                  {group.name}
                </td>
                <td style={table.cell}>
                  <div style={componentStyles.resourcesGroupStyle}>
                    {group.resources.map((resourceId) => {
                      const resourceName = getResourceName(resourceId);
                      const weight = weightMap.get(resourceId) || 0;

                      return (
                        <div key={resourceId} style={componentStyles.resourceItemStyle}>
                          <ResourceIcon id={resourceId} name={resourceName} size="sm" />
                          <span style={{ color: colors.text.light }}>{resourceName}</span>
                          <span style={componentStyles.weightStyle}>{formatAmount(weight / 1000)} kg</span>
                        </div>
                      );
                    })}
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
