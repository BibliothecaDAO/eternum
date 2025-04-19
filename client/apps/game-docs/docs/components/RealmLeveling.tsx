import { ETERNUM_CONFIG } from "@/utils/config";
import { resources } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";

// Styles matching BuildableHexes.tsx
const styles = {
  container: {
    marginBottom: "2.5rem",
  },
  title: {
    fontWeight: "bold",
    fontSize: "1.2rem",
    color: "#f0b060",
    marginBottom: "1.5rem",
    borderLeft: "3px solid #f0b060",
    paddingLeft: "0.75rem",
  },
  tableContainer: {
    overflowX: "auto" as const,
    borderRadius: "0.75rem",
    backgroundColor: "rgba(40, 30, 20, 0.5)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
    marginBottom: "1.5rem",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.9rem",
  },
  tableHead: {
    backgroundColor: "rgba(40, 30, 20, 0.7)",
  },
  tableHeaderCell: {
    textAlign: "left" as const,
    padding: "0.75rem 1rem",
    color: "#f0b060",
    fontWeight: "bold",
    borderBottom: "1px solid #6d4923",
  },
  tableCell: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid rgba(109, 73, 35, 0.3)",
    color: "#dfc296",
  },
  tableCellHighlight: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid rgba(109, 73, 35, 0.3)",
    color: "#f0b060",
    fontWeight: "bold",
  },
  icon: {
    marginRight: "0.5rem",
  },
};

export const RealmLeveling = () => {
  const config = ETERNUM_CONFIG();
  const { realmUpgradeCosts } = config;

  // Level names corresponding to levels 1-4
  const levelNames = ["Settlement", "City", "Kingdom", "Empire"];

  // Helper function to get resource name
  const getResourceName = (id: number): string => {
    return resources.find((r) => r.id === id)?.trait || `Resource ${id}`;
  };

  // Helper function to format numbers with commas
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat().format(Math.round(amount * 100) / 100);
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

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        <span style={styles.icon}>⬆️</span>Realm Upgrade Costs
      </h2>
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeaderCell}>Current Level</th>
              <th style={styles.tableHeaderCell}>Next Level</th>
              <th style={styles.tableHeaderCell}>Resources Required</th>
            </tr>
          </thead>
          <tbody>
            {levelData.slice(0, 3).map((item, index) => (
              <tr key={index}>
                <td style={styles.tableCell}>{item.currentLevel}</td>
                <td style={styles.tableCell}>{item.nextLevel}</td>
                <td style={styles.tableCell}>
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
                        <div
                          key={`${cost.resource}-${idx}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            padding: "0.125rem 0.25rem",
                            backgroundColor: "rgba(40, 30, 25, 0.6)",
                            borderRadius: "0.25rem",
                            fontSize: "0.85rem",
                          }}
                        >
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
