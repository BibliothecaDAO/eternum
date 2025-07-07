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
  };

  // Hardcoded realm leveling data for blitz
  const levelData = [
    {
      currentLevel: "Settlement",
      nextLevel: "City",
      resources: [
        { id: 23, amount: 2000 }, // Labor
        { id: 35, amount: 1200 }, // Wheat
        { id: "essence", amount: 200 }, // Essence (placeholder)
      ]
    },
    {
      currentLevel: "City",
      nextLevel: "Kingdom",
      resources: [
        { id: 23, amount: 4000 }, // Labor
        { id: 35, amount: 3600 }, // Wheat
        { id: "essence", amount: 1200 }, // Essence (placeholder)
        { id: 3, amount: 600 },   // Wood
      ]
    },
    {
      currentLevel: "Kingdom",
      nextLevel: "Empire",
      resources: [
        { id: 23, amount: 8000 }, // Labor
        { id: 35, amount: 7200 }, // Wheat
        { id: "essence", amount: 4800 }, // Essence (placeholder)
        { id: 3, amount: 1800 },  // Wood
        { id: 2, amount: 1200 },  // Coal
        { id: 4, amount: 1200 },  // Copper
      ]
    }
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
                <td style={table.cell}>{item.currentLevel}</td>
                <td style={table.cell}>{item.nextLevel}</td>
                <td style={table.cell}>
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
                        {resource.id === "essence" ? (
                          <div style={{
                            width: "20px",
                            height: "20px",
                            backgroundColor: "#f8bbd9",
                            borderRadius: "2px",
                            border: "1px solid #ec4899",
                            flexShrink: 0
                          }} />
                        ) : (
                          <ResourceIcon id={typeof resource.id === 'number' ? resource.id : 0} name="" size="md" />
                        )}
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