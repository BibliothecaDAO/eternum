// Styles matching DefendingArmies.tsx
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

export const BuildableHexes = () => {
  const buildableHexes = [
    { level: "Settlement", hexes: 6, description: "A small settlement with a few buildings." },
    { level: "City", hexes: 18, description: "A glorious city with many districts." },
    { level: "Kingdom", hexes: 36, description: "A kingdom with many cities and towns." },
    { level: "Empire", hexes: 60, description: "A vast empire with many kingdoms and cities." },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>
        <span style={styles.icon}>🏗️</span>Buildable Hexes by Realm Level
      </h2>
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.tableHeaderCell}>Realm Level</th>
              <th style={styles.tableHeaderCell}>Buildable Hexes</th>
              <th style={styles.tableHeaderCell}>Description</th>
            </tr>
          </thead>
          <tbody>
            {buildableHexes.map((item) => (
              <tr key={item.level}>
                <td style={styles.tableCell}>{item.level}</td>
                <td style={styles.tableCellHighlight}>{item.hexes}</td>
                <td style={styles.tableCell}>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
