import { ETERNUM_CONFIG } from "@/utils/config";
import { resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { formatAmount, section, table } from "./styles";

export const RealmLeveling = () => {
  const config = ETERNUM_CONFIG();
  const { realmUpgradeCosts } = config;

  // Level names corresponding to levels 1-4
  const levelNames = ["Settlement", "City", "Kingdom", "Empire"];

  // Helper function to get resource name
  const getResourceName = (id: number): string => {
    return resources.find((r) => r.id === id)?.trait || `Resource ${id}`;
  };

  // Create an array of level data with costs
  const levelData = levelNames.map((name, index) => {
    const level = index + 1;
    const nextLevel = level + 1;
    const costs = level < 4 ? realmUpgradeCosts[level] : null;

    return {
      currentLevel: name,
      nextLevel: nextLevel <= 4 ? levelNames[index + 1] : "Max Level",
      costs: costs,
    };
  });

  // Resource item style
  const resourceItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.125rem 0.25rem",
    backgroundColor: "rgba(40, 30, 25, 0.6)",
    borderRadius: "0.25rem",
    fontSize: "0.85rem",
  };

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
            {levelData.slice(0, 3).map((item, index) => (
              <tr key={index}>
                <td style={table.cell}>{item.currentLevel}</td>
                <td style={table.cell}>{item.nextLevel}</td>
                <td style={table.cell}>
                  {item.costs && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      {item.costs.map((cost, idx) => (
                        <div key={`${cost.resource}-${idx}`} style={resourceItemStyle}>
                          <ResourceIcon id={cost.resource} name={getResourceName(cost.resource)} size="md" />
                          {formatAmount(cost.amount)}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
