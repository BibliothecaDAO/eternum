import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "../ResourceIcon";
import { section, table } from "../styles";
import { formatNumberWithCommas } from "@/utils/formatting";

export const ExplorationRewards = () => {
  const rewards = [
    { material: "Essence", id: ResourcesIds.Essence, percent: 15, chance: 35 },
    { material: "Essence", id: ResourcesIds.Essence, percent: 30, chance: 25 },
    { material: "Essence", id: ResourcesIds.Essence, percent: 60, chance: 15 },
    { material: "Labor", id: ResourcesIds.Labor, percent: 50, chance: 15 },
    { material: "Labor", id: ResourcesIds.Labor, percent: 100, chance: 5 },
    { material: "Donkeys", id: ResourcesIds.Donkey, percent: 50, chance: 5 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Exploration Rewards</div>

      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Material</th>
              <th style={table.headerCell}>Share of army strength</th>
              <th style={table.headerCell}>1,000 T1 troops earn</th>
              <th style={table.headerCell}>Chance of Discovery</th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((reward, index) => (
              <tr key={index}>
                <td style={table.resourceCell}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    <ResourceIcon name={reward.material} id={reward.id} size="sm" />
                    {reward.material}
                  </span>
                </td>
                <td style={table.cell}>{reward.percent}%</td>
                <td style={table.cell}>{formatNumberWithCommas(reward.percent * 10)}</td>
                <td style={table.cell}>{reward.chance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
