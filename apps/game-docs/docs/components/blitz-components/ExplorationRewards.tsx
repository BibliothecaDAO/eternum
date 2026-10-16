import { ETERNUM_CONFIG } from "@/utils/config";
import { formatNumberWithCommas } from "@/utils/formatting";
import { resources } from "@bibliothecadao/types";
import ResourceIcon from "../ResourceIcon";
import { section, table } from "../styles";

type ExplorationReward = { rewardId: number; percent: number; probabilityBps: number };

/** A reveal's possible rewards, from the Blitz config: a share of the exploring army's strength, up to the cap. */
export const ExplorationRewards = () => {
  const config = ETERNUM_CONFIG("blitz");
  const rewards: ExplorationReward[] = config.blitz.exploration.rewards;
  const strengthCap: number = config.troop.limit.exploreRewardStrengthCap;

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Exploration Rewards</div>

      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Material</th>
              <th style={table.headerCell}>Share of army strength</th>
              <th style={table.headerCell}>An army at {formatNumberWithCommas(strengthCap)} strength finds</th>
              <th style={table.headerCell}>Chance of Discovery</th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((reward, index) => {
              const material = resources.find((resource) => resource.id === reward.rewardId)?.trait ?? "";
              return (
                <tr key={index}>
                  <td style={table.resourceCell}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                      <ResourceIcon name={material} id={reward.rewardId} size="sm" />
                      {material}
                    </span>
                  </td>
                  <td style={table.cell}>{reward.percent}%</td>
                  <td style={table.cell}>{formatNumberWithCommas((reward.percent * strengthCap) / 100)}</td>
                  <td style={table.cell}>{reward.probabilityBps / 100}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
