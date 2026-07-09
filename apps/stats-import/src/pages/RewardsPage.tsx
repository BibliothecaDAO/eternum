import React from 'react';
import { useParams } from 'react-router-dom';
import Rewards from '../components/Rewards';

interface RewardsPageProps {
  lordsPrice: number;
  strkPrice: number;
}

const rewardTabs = ['victory', 'cartridge', 'daydreams', 'chests'] as const;
type RewardTab = typeof rewardTabs[number];

const RewardsPage: React.FC<RewardsPageProps> = ({ lordsPrice, strkPrice }) => {
  const { tab } = useParams<{ tab?: string }>();
  const initialTab = rewardTabs.includes(tab as RewardTab) ? (tab as RewardTab) : undefined;
  
  return (
    <Rewards 
      lordsPrice={lordsPrice}
      strkPrice={strkPrice}
      initialTab={initialTab}
    />
  );
};

export default RewardsPage; 