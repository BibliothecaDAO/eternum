import { durationOf, ETERNUM_CONFIG } from "@/utils/config";
import { formatNumberWithCommas } from "@/utils/formatting";
import { icon, stats, table, troop } from "../styles";

const LEVELS = [
  ["Settlement", "settlement"],
  ["City", "city"],
  ["Kingdom", "kingdom"],
  ["Empire", "empire"],
] as const;
const TIERS = ["t1", "t2", "t3"] as const;

/**
 * A structure's troop limits by its level, as the game applies them: its field armies, and the largest army of each tier
 * (the level's deployment cap times the tier's modifier, over its strength; troops.cairo `max_army_size`).
 */
export default function TroopsLimitTable() {
  const limit = ETERNUM_CONFIG("eternum").troop.limit;
  const largestArmy = (level: string, tier: string) =>
    (limit[`${level}DeploymentCap`] * limit[`${tier}TierModifier`]) / (limit[`${tier}TierStrength`] * 100);

  return (
    <div style={troop.limitsCard}>
      <div style={troop.header}>
        <span style={icon.wrapper}>🔣</span> Troop Limits
      </div>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Level</th>
            <th style={table.headerCell}>Field armies</th>
            {TIERS.map((tier) => (
              <th key={tier} style={table.headerCell}>
                Largest {tier.toUpperCase()} army
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEVELS.map(([name, level]) => (
            <tr key={level}>
              <td style={table.weightCell}>{name}</td>
              <td style={table.weightCell}>{formatNumberWithCommas(limit[`${level}Armies`])}</td>
              {TIERS.map((tier) => (
                <td key={tier} style={table.weightCell}>
                  {formatNumberWithCommas(largestArmy(level, tier))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <div style={stats.label}>Guard Resurrection:</div>
        <div style={stats.value}>{durationOf(limit.guardResurrectionDelay)}</div>
      </div>
    </div>
  );
}
