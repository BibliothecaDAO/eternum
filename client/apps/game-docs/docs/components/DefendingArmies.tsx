// Styles matching BiomeCombat.tsx
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

// Component 1: Total Armies by Realm Level
export const TotalArmiesTable = () => {
  const realmLevelArmies = [
    { level: "Settlement", totalArmies: 2 },
    { level: "City", totalArmies: 3 },
    { level: "Kingdom", totalArmies: 5 },
    { level: "Empire", totalArmies: 7 },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        <span style={styles.icon}>🏰</span>Total Armies by Realm Level
      </h2>
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeaderCell}>Realm / Village Level</th>
              <th style={styles.tableHeaderCell}>Base No. Total Armies</th>
            </tr>
          </thead>
          <tbody>
            {realmLevelArmies.map((item) => (
              <tr key={item.level}>
                <td style={styles.tableCell}>{item.level}</td>
                <td style={styles.tableCellHighlight}>{item.totalArmies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component 2: Defense Slots by Realm Level
export const RealmDefenseSlotsTable = () => {
  const defenseSlots = [
    { level: "Settlement", slots: 1 },
    { level: "City", slots: 2 },
    { level: "Kingdom", slots: 3 },
    { level: "Empire", slots: 4 },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        <span style={styles.icon}>🛡️</span>Defense Slots by Realm Level
      </h2>
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeaderCell}>Realm / Village Level</th>
              <th style={styles.tableHeaderCell}>No. Defense Slots</th>
            </tr>
          </thead>
          <tbody>
            {defenseSlots.map((item) => (
              <tr key={item.level}>
                <td style={styles.tableCell}>{item.level}</td>
                <td style={styles.tableCellHighlight}>{item.slots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component 3: Defense Slots by Structure Type
export const WorldStructureDefenseSlotsTable = () => {
  const worldStructures = [
    { structure: "Fragment Mine", slots: 1 },
    { structure: "Hyperstructure Foundation", slots: 2 },
    { structure: "Hyperstructure (complete)", slots: 4 },
    { structure: "Bank", slots: 4 },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        <span style={styles.icon}>🏛️</span>Defense Slots by Structure Type
      </h2>
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeaderCell}>World Structure</th>
              <th style={styles.tableHeaderCell}>No. Defense Slots</th>
            </tr>
          </thead>
          <tbody>
            {worldStructures.map((item) => (
              <tr key={item.structure}>
                <td style={styles.tableCell}>{item.structure}</td>
                <td style={styles.tableCellHighlight}>{item.slots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
