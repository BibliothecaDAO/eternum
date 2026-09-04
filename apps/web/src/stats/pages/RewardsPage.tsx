import React from "react";
import Rewards from "../components/Rewards";

interface RewardsPageProps {
  lordsPrice: number;
  strkPrice: number;
  tab?: string;
}

const rewardTabs = ["victory", "cartridge", "daydreams", "chests"] as const;
type RewardTab = (typeof rewardTabs)[number];

const RewardsPage: React.FC<RewardsPageProps> = ({ lordsPrice, strkPrice, tab }) => {
  const initialTab = rewardTabs.includes(tab as RewardTab) ? (tab as RewardTab) : undefined;

  return <Rewards lordsPrice={lordsPrice} strkPrice={strkPrice} initialTab={initialTab} />;
};

export default RewardsPage;
