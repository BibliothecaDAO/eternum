import { getResourceTiers, RESOURCE_TIER_NAMES, resourceName } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { colors, section, table } from "./styles";

/**
 * Every group of Eternum's resources, as the game itself groups and names them (its resource table reads the same
 * catalog), each resource by its name in the game's table. Relics have their own section on the page.
 */
const RESOURCE_GROUPS = Object.entries(getResourceTiers(false))
  .filter(([tier]) => tier !== "relics")
  .map(([tier, ids]) => ({
    name: RESOURCE_TIER_NAMES[tier as keyof typeof RESOURCE_TIER_NAMES],
    resources: ids.map((id) => ({ id, name: resourceName(id) })),
  }));

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
    padding: "0.2rem 0.35rem",
    backgroundColor: colors.background.dark,
    borderRadius: "0.35rem",
    fontSize: "0.75rem",
    border: `1px solid ${colors.border}`,
  },
  rarityCellStyle: {
    ...table.cell,
    color: colors.text.light,
    fontWeight: 500,
  },
};

const RarityResourceTable = () => {
  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ fontSize: "0.85em", fontWeight: 400 }}>Material Rarity Categories</span>
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Rarity</th>
              <th style={table.headerCell}>Materials</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCE_GROUPS.map((category) => {
              return (
                <tr key={category.name}>
                  <td style={componentStyles.rarityCellStyle}>{category.name}</td>
                  <td style={table.cell}>
                    <div style={componentStyles.resourcesGroupStyle}>
                      {category.resources.map((resource) => (
                        <div key={resource.id} style={componentStyles.resourceItemStyle}>
                          <ResourceIcon name={resource.name} id={resource.id} size="sm" />
                          <span style={{ color: colors.text.light }}>{resource.name}</span>
                        </div>
                      ))}
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

export default RarityResourceTable;
