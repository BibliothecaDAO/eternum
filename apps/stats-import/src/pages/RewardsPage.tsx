import React from 'react';
import Rewards from '../components/Rewards';

interface RewardsPageProps {
  lordsPrice: number;
  strkPrice: number;
}

const RewardsPage: React.FC<RewardsPageProps> = ({ lordsPrice, strkPrice }) => {
  return (
    <Rewards 
      lordsPrice={lordsPrice}
      strkPrice={strkPrice}
    />
  );
};

export default RewardsPage; 