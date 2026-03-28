import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "../ResourceIcon";
import { section, table } from "../styles";
import { formatNumberWithCommas } from "@/utils/formatting";

export const ExplorationRewards = () => {
  const rewards = [
    { material: "Essence", id: 38, quantity: 150, chance: 35 },
    { material: "Essence", id: 38, quantity: 300, chance: 25 },
    { material: "Essence", id: 38, quantity: 600, chance: 15 },
    { material: "Labor", id: ResourcesIds.Labor, quantity: 500, chance: 15 },
    { material: "Labor", id: ResourcesIds.Labor, quantity: 1000, chance: 5 },
    { material: "Donkeys", id: ResourcesIds.Donkey, quantity: 500, chance: 5 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Exploration Rewards</div>

      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Material</th>
              <th style={table.headerCell}>Quantity</th>
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
                <td style={table.cell}>{formatNumberWithCommas(reward.quantity)}</td>
                <td style={table.cell}>{reward.chance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
