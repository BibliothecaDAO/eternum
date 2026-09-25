import { buildablePlotCount, configManager } from "@bibliothecadao/eternum";

/** What a castle level gives, read from the game's own rules: its plots, its field armies and each army's strength cap. */
const castleLevelGains = (level: number) => ({
  plots: buildablePlotCount(level),
  armies: configManager.getArmySlots(level),
  deploymentCap: configManager.getDeploymentCap(level),
});

/** One line per level: "18 buildable plots · 4 armies of up to 9,000 strength". */
export const describeCastleLevel = (level: number): string => {
  const { plots, armies, deploymentCap } = castleLevelGains(level);
  return `${plots} buildable plots · ${armies} ${armies === 1 ? "army" : "armies"} of up to ${deploymentCap.toLocaleString()} strength`;
};
