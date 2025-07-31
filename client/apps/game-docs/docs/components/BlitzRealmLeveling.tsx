import ResourceIcon from "@/components/ResourceIcon";
import { formatAmount, section, table } from "@/components/styles";

export const BlitzRealmLeveling = () => {
  // Resource item style matching the original component
  const resourceItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.125rem 0.25rem",
    backgroundColor: "rgba(40, 30, 25, 0.6)",
    borderRadius: "0.25rem",
    fontSize: "0.85rem",
    whiteSpace: "nowrap" as const,
    minWidth: "fit-content",
  };

  // Updated table cell style to prevent wrapping
  const tableCellStyle = {
    padding: "0.5rem",
    borderBottom: "1px solid #4d3923",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    verticalAlign: "middle" as const,
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
        { id: 23, amount: 2000 }, // Labor
        { id: 35, amount: 1200 }, // Wheat
        { id: 38, amount: 200 }, // Essence
      ],
    },
    {
      currentLevel: "City",
      nextLevel: "Kingdom",
      resources: [
        { id: 23, amount: 4000 }, // Labor
        { id: 35, amount: 3600 }, // Wheat
        { id: 38, amount: 1200 }, // Essence
        { id: 3, amount: 600 }, // Wood
      ],
    },
    {
      currentLevel: "Kingdom",
      nextLevel: "Empire",
      resources: [
        { id: 23, amount: 8000 }, // Labor
        { id: 35, amount: 7200 }, // Wheat
        { id: 38, amount: 4800 }, // Essence
        { id: 3, amount: 1800 }, // Wood
        { id: 2, amount: 1200 }, // Coal
        { id: 4, amount: 1200 }, // Copper
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
