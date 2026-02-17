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
      <div style={section.accentedTitle}>
        <span style={{ fontSize: "0.85em", fontWeight: 400 }}>Max Stamina Comparison</span>
      </div>

      <table style={table.compareTable}>
        <thead style={table.tableHead}>
          <tr>
            <th style={{ ...table.tableHeaderCell, ...table.tableFirstColumn }}>Tier</th>
            {troopTypes.map((troopId) => (
              <th key={troopId} style={table.tableHeaderCell}>
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
                  <td key={troopId} style={{ ...table.tableCell, textAlign: "left", fontWeight: "bold" }}>
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

export function BlitzTroopMovementTable() {
  const config = ETERNUM_CONFIG();

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Military Units</div>

      {/* Common stats for all troops */}
      <div style={section.commonCard}>
        <div style={section.accentedTitle}>Troop Movement</div>

        <div style={section.sectionContent}>
          <div>
            <div style={section.sectionHeader}>
              <span>💪</span> Capacity
            </div>
            <div style={section.sectionGrid}>
              <StatItem
                label="Carry Capacity"
                value={`${Number(config.carryCapacityGram[CapacityConfig.Army]) / 1000}kg per troop`}
              />
            </div>
          </div>

          <div>
            <div style={section.sectionHeader}>
              <span>⚡</span> Stamina
            </div>
            <div style={section.sectionGrid}>
              <StatItem label="Stamina on Deployment" value={config.troop.stamina.staminaInitial} />
              <StatItem label="Gain Per Phase" value={20} />
            </div>
          </div>
        </div>

        <div style={section.divider}></div>

        <div style={section.sectionContent}>
          <div>
            <div style={section.sectionHeader}>
              <span>🚶</span> Movement Costs
            </div>
            <div style={section.sectionGrid}>
              <StatItem label="Travel Stamina Cost" value={`${config.troop.stamina.staminaTravelStaminaCost}/hex`} />
              <StatItem label="Explore Stamina Cost" value={`${config.troop.stamina.staminaExploreStaminaCost}/hex`} />
              <StatItem label="Biome Bonus/Penalty" value={`±${config.troop.stamina.staminaBonusValue}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Using the separate MaxStaminaTable component */}
      <BlitzMaxStaminaTable />
    </div>
  );
}
