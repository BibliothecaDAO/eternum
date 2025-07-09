import { ETERNUM_CONFIG } from "@/utils/config";
import { formatNumberWithCommas } from "@/utils/formatting";
import { CapacityConfig, ResourcesIds } from "@bibliothecadao/types";
import { icon, section, stats, table } from "./styles";

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

export const getTroopIcon = (troopId: number) => {
  switch (troopId) {
    case ResourcesIds.Paladin:
      return "🐴";
    case ResourcesIds.Knight:
      return "⚔️";
    case ResourcesIds.Crossbowman:
      return "🏹";
    default:
      return "👤";
  }
};

// Separate component for Max Stamina Table
export const MaxStaminaTable = () => {
  const troopTypes = [ResourcesIds.Paladin, ResourcesIds.Knight, ResourcesIds.Crossbowman];
  const config = ETERNUM_CONFIG();

  return (
    <div style={section.commonCard}>
      <div style={section.commonHeader}>
        <span>⚡️</span> Max Stamina Comparison
      </div>

      <table style={table.compareTable}>
        <thead style={table.tableHead}>
          <tr>
            <th style={{ ...table.tableHeaderCell, ...table.tableFirstColumn }}>Tier</th>
            {troopTypes.map((troopId) => (
              <th key={troopId} style={table.tableHeaderCell}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={icon.wrapper}>{getTroopIcon(troopId)}</span>
                  {getTroopName(troopId)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((tier) => (
            <tr key={tier} style={table.tableRow}>
              <td style={{ ...table.tableCell, ...table.tableFirstColumn }}>
                <div style={table.tableTierCell}>
                  <span style={table.tierBadge}>T{tier}</span>
                  {tier > 1 ? `+${(tier - 1) * 20} bonus` : "Base"}
                </div>
              </td>
              {troopTypes.map((troopId) => {
                const troopName = getTroopName(troopId);
                const baseStamina = config.troop.stamina[`stamina${troopName}Max`];
                const tierStamina = baseStamina + (tier - 1) * 20;

                return (
                  <td key={troopId} style={{ ...table.tableCell, textAlign: "center", fontWeight: "bold" }}>
                    {tierStamina}
                  </td>
                );
              })}
            </tr>
          ))}
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

export default function TroopMovementTable() {
  const config = ETERNUM_CONFIG();

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Military Units</div>

      {/* Common stats for all troops */}
      <div style={section.commonCard}>
        <div style={section.commonHeader}>
          <span>🏃‍♂️</span> Troop Movement
        </div>

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
              <StatItem label="Gain Per Eternum Day" value={config.troop.stamina.staminaGainPerTick} />
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

          <div>
            <div style={section.sectionHeader}>
              <span>🍲</span> Food Consumption
            </div>
            <div style={section.sectionGrid}>
              <div style={section.fullWidthHeader}>
                <span>🧭</span> Food Required per Troop per Hex Traveled:
              </div>
              <StatItem label="Wheat" value={config.troop.stamina.staminaTravelWheatCost} />
              <StatItem label="Fish" value={config.troop.stamina.staminaTravelFishCost} />

              <div style={section.fullWidthHeader}>
                <span>🔍</span> Food Required per Troop per Hex Explored:
              </div>
              <StatItem label="Wheat" value={config.troop.stamina.staminaExploreWheatCost} />
              <StatItem label="Fish" value={config.troop.stamina.staminaExploreFishCost} />

              <div style={section.fullWidthHeader}>
                <span>📊</span> Example for 1000 Troops Traveling 10 Hexes:
              </div>
              <StatItem
                label="Total Wheat"
                value={`${formatNumberWithCommas(config.troop.stamina.staminaTravelWheatCost * 1000 * 10)} wheat`}
              />
              <StatItem
                label="Total Fish"
                value={`${formatNumberWithCommas(config.troop.stamina.staminaTravelFishCost * 1000 * 10)} fish`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Using the separate MaxStaminaTable component */}
      <MaxStaminaTable />
    </div>
  );
}

export function BlitzTroopMovementTable() {
  const config = ETERNUM_CONFIG();

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Military Units</div>

      {/* Common stats for all troops */}
      <div style={section.commonCard}>
        <div style={section.commonHeader}>
          <span>🏃‍♂️</span> Troop Movement
        </div>

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
              <StatItem label="Gain Per Eternum Day" value={60} />
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
      <MaxStaminaTable />
    </div>
  );
}
