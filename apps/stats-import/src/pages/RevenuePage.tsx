import React from 'react';
import RevenueChart from '../components/RevenueChart';
import FeeTable from '../components/FeeTable';
import { RevenueData } from '../types';

interface RevenuePageProps {
  revenueData: RevenueData[];
  lordsPrice: number;
  totalLords: number;
}

const RevenuePage: React.FC<RevenuePageProps> = ({ revenueData, lordsPrice, totalLords }) => {
  return (
    <>
      <RevenueChart 
        revenueData={revenueData}
        lordsPrice={lordsPrice}
        totalLords={totalLords}
      />
      
      <FeeTable 
        revenueData={revenueData}
        lordsPrice={lordsPrice}
      />
    </>
  );
};

export default RevenuePage; 