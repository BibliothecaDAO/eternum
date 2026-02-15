import ResourceIcon from "@/components/ResourceIcon";
import { colors, formatAmount, section, table } from "@/components/styles";

export const BlitzRealmLeveling = () => {
  // Resource item style matching the original component
  const resourceItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.2rem 0.4rem",
    backgroundColor: colors.background.dark,
    borderRadius: "0.35rem",
    fontSize: "0.85rem",
    whiteSpace: "nowrap" as const,
    minWidth: "fit-content",
    border: `1px solid ${colors.border}`,
  };

  // Updated table cell style to prevent wrapping
  const tableCellStyle = {
    ...table.cell,
    whiteSpace: "nowrap" as const,
  };

  const resourcesCellStyle = {
    ...tableCellStyle,
    whiteSpace: "normal" as const, // Allow wrapping for the resources cell since it contains multiple items
  };

  // Hardcoded realm leveling data for blitz
  const levelData = [
    {
      currentLevel: "Settlement",
      nextLevel: "City",
      resources: [
        { id: 23, amount: 180 }, // Labor
        { id: 35, amount: 1200 }, // Wheat
        { id: 38, amount: 250 }, // Essence
      ],
    },
    {
      currentLevel: "City",
      nextLevel: "Kingdom",
      resources: [
        { id: 23, amount: 360 }, // Labor
        { id: 35, amount: 2400 }, // Wheat
        { id: 38, amount: 600 }, // Essence
        { id: 3, amount: 180 }, // Wood
      ],
    },
    {
      currentLevel: "Kingdom",
      nextLevel: "Empire",
      resources: [
        { id: 23, amount: 720 }, // Labor
        { id: 35, amount: 4800 }, // Wheat
        { id: 38, amount: 1200 }, // Essence
        { id: 3, amount: 360 }, // Wood
        { id: 2, amount: 180 }, // Coal
        { id: 4, amount: 180 }, // Copper
      ],
    },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ marginRight: "0.5rem" }}>⬆️</span>Realm Upgrade Costs
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Current Level</th>
              <th style={table.headerCell}>Next Level</th>
              <th style={table.headerCell}>Resources Required</th>
            </tr>
          </thead>
          <tbody>
            {levelData.map((item, index) => (
              <tr key={index}>
                <td style={tableCellStyle}>{item.currentLevel}</td>
                <td style={tableCellStyle}>{item.nextLevel}</td>
                <td style={resourcesCellStyle}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    {item.resources.map((resource, idx) => (
                      <div key={`${resource.id}-${idx}`} style={resourceItemStyle}>
                        <div style={{ minWidth: "20px", display: "flex", justifyContent: "center" }}>
                          <ResourceIcon id={typeof resource.id === "number" ? resource.id : 0} name="" size="md" />
                        </div>
                        {formatAmount(resource.amount)}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
