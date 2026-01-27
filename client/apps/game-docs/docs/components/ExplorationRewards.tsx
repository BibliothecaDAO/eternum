import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "./ResourceIcon";
import { section, table } from "./styles";

export const ExplorationRewards = () => {
  const rewards = [
    { material: "Essence", id: 38, quantity: 100, chance: 30 },
    { material: "Essence", id: 38, quantity: 250, chance: 20 },
    { material: "Essence", id: 38, quantity: 500, chance: 15 },
    { material: "Labor", id: ResourcesIds.Labor, quantity: 250, chance: 15 },
    { material: "Labor", id: ResourcesIds.Labor, quantity: 500, chance: 8 },
    { material: "Donkeys", id: ResourcesIds.Donkey, quantity: 100, chance: 6 },
    { material: "T1 Knights", id: ResourcesIds.Knight, quantity: 1000, chance: 2 },
    { material: "T1 Crossbowmen", id: ResourcesIds.Crossbowman, quantity: 1000, chance: 2 },
    { material: "T1 Paladins", id: ResourcesIds.Paladin, quantity: 1000, chance: 2 },
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
                  <ResourceIcon name={reward.material} id={reward.id} size="sm" />
                  {reward.material}
                </td>
                <td style={table.cell}>{reward.quantity.toLocaleString()}</td>
                <td style={table.cell}>{reward.chance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
