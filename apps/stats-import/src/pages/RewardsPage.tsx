import React from 'react';
import { useParams } from 'react-router-dom';
import Rewards from '../components/Rewards';

interface RewardsPageProps {
  lordsPrice: number;
  strkPrice: number;
}

const RewardsPage: React.FC<RewardsPageProps> = ({ lordsPrice, strkPrice }) => {
  const { tab } = useParams<{ tab?: string }>();
  
  return (
    <Rewards 
      lordsPrice={lordsPrice}
      strkPrice={strkPrice}
      initialTab={tab as 'victory' | 'cartridge' | 'daydreams' | 'chests' | undefined}
    />
  );
};

export default RewardsPage; 