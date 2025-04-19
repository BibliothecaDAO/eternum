import { ETERNUM_CONFIG } from "@/utils/config";
import { CapacityConfig, ResourcesIds } from "@bibliothecadao/types";

// Enhanced styles with better visual hierarchy and responsiveness
const styles = {
  sectionStyle: {
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
  troopsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1.25rem",
    "@media (min-width: 640px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  troopCard: {
    padding: "1.25rem",
    borderRadius: "0.75rem",
    backgroundColor: "rgba(30, 20, 10, 0.4)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
    transition: "transform 0.2s, box-shadow 0.2s",
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    },
  },
  troopHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1.25rem",
    color: "#dfc296",
    fontWeight: 600,
    fontSize: "1.1rem",
    paddingBottom: "0.75rem",
    borderBottom: "1px solid #6d4923",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: "bold",
    color: "#f0b060",
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  statItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#f9fafb",
    opacity: 0.85,
  },
  statValue: {
    color: "#dfc296",
    fontSize: "0.95rem",
    fontWeight: 500,
  },
  divider: {
    margin: "1.25rem 0",
    borderTop: "1px solid rgba(109, 73, 35, 0.5)",
  },
  fullWidthHeader: {
    gridColumn: "1 / -1",
    fontWeight: 600,
    color: "#e5c687",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  commonStatsCard: {
    padding: "1.5rem",
    borderRadius: "0.75rem",
    backgroundColor: "rgba(40, 30, 20, 0.5)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
    marginBottom: "2rem",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  commonStatsHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontWeight: "bold",
    color: "#f0b060",
    marginBottom: "1.5rem",
    fontSize: "1.1rem",
    paddingBottom: "0.75rem",
    borderBottom: "1px solid #6d4923",
  },
  sectionContent: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1.5rem",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
  },
  iconWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "2rem",
    height: "2rem",
    borderRadius: "50%",
    backgroundColor: "rgba(240, 176, 96, 0.1)",
    marginRight: "0.5rem",
  },
  compareTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: "1.5rem",
  },
  tableHead: {
    borderBottom: "1px solid #6d4923",
  },
  tableHeaderCell: {
    textAlign: "left" as const,
    padding: "0.75rem 0.5rem",
    color: "#f0b060",
    fontSize: "0.9rem",
    fontWeight: "bold",
  },
  tableFirstColumn: {
    width: "30%",
    paddingLeft: "0",
  },
  tableCell: {
    padding: "0.75rem 0.5rem",
    color: "#dfc296",
    fontSize: "0.95rem",
    borderBottom: "1px solid rgba(109, 73, 35, 0.3)",
  },
  tableRow: {
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "rgba(240, 176, 96, 0.05)",
    },
  },
  tableTierCell: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "#f9fafb",
  },
  tierBadge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: "0.25rem",
    fontSize: "0.8rem",
    fontWeight: "bold",
    backgroundColor: "rgba(240, 176, 96, 0.1)",
    color: "#f0b060",
  },
  staminaMaxCard: {
    padding: "1.5rem",
    borderRadius: "0.75rem",
    backgroundColor: "rgba(40, 30, 20, 0.5)",
    borderBottom: "1px solid #4d3923",
    borderLeft: "1px solid #4d3923",
    marginBottom: "2rem",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
};

export default function TroopMovementTable() {
  const troopTypes = [ResourcesIds.Paladin, ResourcesIds.Knight, ResourcesIds.Crossbowman];
  const config = ETERNUM_CONFIG();

  const getTroopName = (troopId: number) => {
    switch (troopId) {
      case ResourcesIds.Paladin:
        return "Paladin";
      case ResourcesIds.Knight:
        return "Knight";
      case ResourcesIds.Crossbowman:
        return "Crossbowman";
      default:
        return "Unknown";
    }
  };

  const getTroopIcon = (troopId: number) => {
    switch (troopId) {
      case ResourcesIds.Paladin:
        return "🛡️";
      case ResourcesIds.Knight:
        return "⚔️";
      case ResourcesIds.Crossbowman:
        return "🏹";
      default:
        return "👤";
    }
  };

  // Reusable component for stat items
  const StatItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={styles.statItem}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  );

  return (
    <div style={styles.sectionStyle}>
      <div style={styles.title}>Military Units</div>

      {/* Common stats for all troops */}
      <div style={styles.commonStatsCard}>
        <div style={styles.commonStatsHeader}>
          <span>🏃‍♂️</span> Troop Movement
        </div>

        <div style={styles.sectionContent}>
          <div>
            <div style={styles.sectionHeader}>
              <span>💪</span> Capacity
            </div>
            <div style={styles.statsGrid}>
              <StatItem
                label="Carry Capacity"
                value={`${Number(config.carryCapacityGram[CapacityConfig.Army]) / 1000}kg per troop`}
              />
            </div>
          </div>

          <div>
            <div style={styles.sectionHeader}>
              <span>⚡</span> Stamina
            </div>
            <div style={styles.statsGrid}>
              <StatItem label="Initial Stamina" value={config.troop.stamina.staminaInitial} />
              <StatItem label="Gain Per Tick" value={config.troop.stamina.staminaGainPerTick} />
            </div>
          </div>
        </div>

        <div style={styles.divider}></div>

        <div style={styles.sectionContent}>
          <div>
            <div style={styles.sectionHeader}>
              <span>🚶</span> Movement Costs
            </div>
            <div style={styles.statsGrid}>
              <StatItem label="Travel Stamina Cost" value={`${config.troop.stamina.staminaTravelStaminaCost}/hex`} />
              <StatItem label="Explore Stamina Cost" value={`${config.troop.stamina.staminaExploreStaminaCost}/hex`} />
              <StatItem label="Biome Bonus/Penalty" value={`±${config.troop.stamina.staminaBonusValue}`} />
            </div>
          </div>

          <div>
            <div style={styles.sectionHeader}>
              <span>🍲</span> Food Consumption
            </div>
            <div style={styles.statsGrid}>
              <div style={styles.fullWidthHeader}>
                <span>🧭</span> Food Required per Troop per Hex Traveled:
              </div>
              <StatItem label="Wheat" value={config.troop.stamina.staminaTravelWheatCost} />
              <StatItem label="Fish" value={config.troop.stamina.staminaTravelFishCost} />

              <div style={styles.fullWidthHeader}>
                <span>🔍</span> Food Required per Troop per Hex Explored:
              </div>
              <StatItem label="Wheat" value={config.troop.stamina.staminaExploreWheatCost} />
              <StatItem label="Fish" value={config.troop.stamina.staminaExploreFishCost} />

              <div style={styles.fullWidthHeader}>
                <span>📊</span> Example for 1000 Troops Traveling 10 Hexes:
              </div>
              <StatItem
                label="Total Wheat"
                value={`${config.troop.stamina.staminaTravelWheatCost * 1000 * 10} wheat`}
              />
              <StatItem label="Total Fish" value={`${config.troop.stamina.staminaTravelFishCost * 1000 * 10} fish`} />
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Stamina Max Table */}
      <div style={styles.staminaMaxCard}>
        <div style={styles.commonStatsHeader}>
          <span>⚡️</span> Max Stamina Comparison
        </div>

        <table style={styles.compareTable}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={{ ...styles.tableHeaderCell, ...styles.tableFirstColumn }}>Tier</th>
              {troopTypes.map((troopId) => (
                <th key={troopId} style={styles.tableHeaderCell}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={styles.iconWrapper}>{getTroopIcon(troopId)}</span>
                    {getTroopName(troopId)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((tier) => (
              <tr key={tier} style={styles.tableRow as any}>
                <td style={{ ...styles.tableCell, ...styles.tableFirstColumn }}>
                  <div style={styles.tableTierCell}>
                    <span style={styles.tierBadge}>T{tier}</span>
                    {tier > 1 ? `+${(tier - 1) * 20} bonus` : "Base"}
                  </div>
                </td>
                {troopTypes.map((troopId) => {
                  const troopName = getTroopName(troopId);
                  const baseStamina = config.troop.stamina[`stamina${troopName}Max`];
                  const tierStamina = baseStamina + (tier - 1) * 20;

                  return (
                    <td key={troopId} style={styles.tableCell}>
                      {tierStamina}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
