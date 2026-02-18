import { ETERNUM_CONFIG } from "@/utils/config";
import { CapacityConfig, ResourcesIds } from "@bibliothecadao/types";
import { section, stats, table } from "../styles";

// Helper functions for troop information
export const getTroopName = (troopId: number) => {
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

export const BlitzMaxStaminaTable = () => {
  const troopTypes = [ResourcesIds.Paladin, ResourcesIds.Knight, ResourcesIds.Crossbowman];
  const baseStamina = 120;

  return (
    <div style={section.commonCard}>
      <div style={section.accentedTitle}>Max Stamina Comparison</div>

      <table style={table.compareTable}>
        <thead style={table.tableHead}>
          <tr>
            <th style={{ ...table.tableHeaderCell, ...table.tableFirstColumn }}>Tier</th>
            {troopTypes.map((troopId) => (
              <th key={troopId} style={{ ...table.tableHeaderCell, textAlign: "center" }}>
                {getTroopName(troopId)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((tier) => {
            const tierStamina = baseStamina + (tier - 1) * 20;

            return (
              <tr key={tier} style={table.tableRow}>
                <td style={{ ...table.tableCell, ...table.tableFirstColumn }}>
                  <div style={table.tableTierCell}>
                    <span style={table.tierBadge}>T{tier}</span>
                    {tier > 1 ? `+${(tier - 1) * 20} bonus` : "Base"}
                  </div>
                </td>
                {troopTypes.map((troopId) => (
                  <td key={troopId} style={{ ...table.tableCell, textAlign: "center" }}>
                    {tierStamina}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Reusable component for stat items
const StatItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={stats.item}>
    <span style={stats.label}>{label}</span>
    <span style={stats.value}>{value}</span>
  </div>
);

const listItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.5rem 0",
  borderBottom: `1px solid rgba(107, 98, 80, 0.3)`,
  fontSize: "0.95rem",
};

const listLabelStyle = {
  color: colors.text.light,
  fontSize: "0.95rem",
};

const listValueStyle = {
  color: colors.secondary,
  fontSize: "0.95rem",
};

export function BlitzTroopMovementTable() {
  const config = ETERNUM_CONFIG();

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Military Units</div>

      {/* Common stats for all troops */}
      <div style={section.commonCard}>
        <div style={section.accentedTitle}>Troop Movement</div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={listItemStyle}>
            <span style={listLabelStyle}>Carry Capacity</span>
            <span style={listValueStyle}>{Number(config.carryCapacityGram[CapacityConfig.Army]) / 1000}kg per troop</span>
          </div>
          <div style={listItemStyle}>
            <span style={listLabelStyle}>Stamina on Deployment</span>
            <span style={listValueStyle}>{config.troop.stamina.staminaInitial}</span>
          </div>
          <div style={listItemStyle}>
            <span style={listLabelStyle}>Stamina Gain Per Phase</span>
            <span style={listValueStyle}>20</span>
          </div>
          <div style={listItemStyle}>
            <span style={listLabelStyle}>Travel Stamina Cost</span>
            <span style={listValueStyle}>{config.troop.stamina.staminaTravelStaminaCost}/hex</span>
          </div>
          <div style={listItemStyle}>
            <span style={listLabelStyle}>Explore Stamina Cost</span>
            <span style={listValueStyle}>{config.troop.stamina.staminaExploreStaminaCost}/hex</span>
          </div>
          <div style={{ ...listItemStyle, borderBottom: "none" }}>
            <span style={listLabelStyle}>Biome Bonus/Penalty</span>
            <span style={listValueStyle}>±{config.troop.stamina.staminaBonusValue}</span>
          </div>
        </div>
      </div>

      {/* Using the separate MaxStaminaTable component */}
      <BlitzMaxStaminaTable />
    </div>
  );
}
