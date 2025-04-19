import { ETERNUM_CONFIG } from "@/utils/config";

// Common styles shared with other components
const styles = {
  sectionStyle: {
    marginBottom: "2rem",
  },
  subtitleStyle: {
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: "#f0b060",
    marginBottom: "0.75rem",
    marginTop: "1.5rem",
  },
  title: {
    fontWeight: "bold",
    fontSize: "1.1rem",
    color: "#f0b060",
    marginBottom: "1.25rem",
  },
  troopsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1rem",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  troopCard: {
    padding: "1rem",
    borderRadius: "0.5rem",
    backgroundColor: "rgba(30, 20, 10, 0.3)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
  },
  troopHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1rem",
    color: "#dfc296",
    fontWeight: 600,
    fontSize: "1rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #6d4923",
  },
  sectionHeader: {
    fontWeight: "bold",
    color: "#f0b060",
    marginBottom: "0.5rem",
    fontSize: "0.85rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#f9fafb",
  },
  statValue: {
    color: "#dfc296",
    fontSize: "0.85rem",
  },
  divider: {
    margin: "1rem 0",
    borderTop: "1px solid #6d4923",
  },
  fullWidthHeader: {
    gridColumn: "1 / -1",
    fontWeight: 600,
    color: "#e5c687",
    fontSize: "0.8rem",
  },
  commonStatsCard: {
    padding: "1rem",
    borderRadius: "0.5rem",
    backgroundColor: "rgba(40, 30, 20, 0.4)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
    marginBottom: "1.5rem",
  },
  commonStatsHeader: {
    fontWeight: "bold",
    color: "#f0b060",
    marginBottom: "1rem",
    fontSize: "0.95rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid #6d4923",
  },
};

export default function TroopsLimitTable() {
  const config = ETERNUM_CONFIG();

  return (
    <div style={styles.commonStatsCard}>
      <div style={styles.commonStatsHeader}>
        <span style={styles.icon}>🔣</span> Troop Limits
      </div>
      <div style={styles.statsGrid}>
        <div>
          <div style={styles.statLabel}>Max Field Troops Per Structure:</div>
          <div style={styles.statValue}>{config.troop.limit.explorerMaxPartyCount}</div>
        </div>
        <div>
          <div style={styles.statLabel}>Max Troop Count:</div>
          <div style={styles.statValue}>{config.troop.limit.explorerAndGuardMaxTroopCount}</div>
        </div>
        <div>
          <div style={styles.statLabel}>Guard Resurrection:</div>
          <div style={styles.statValue}>{Math.floor(config.troop.limit.guardResurrectionDelay / 3600)} hours</div>
        </div>
      </div>
    </div>
  );
}
