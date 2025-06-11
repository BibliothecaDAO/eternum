import React from 'react';
import SeasonPassValue from '../components/SeasonPassValue';

interface SeasonPassPageProps {
  lordsPrice: number;
}

const SeasonPassPage: React.FC<SeasonPassPageProps> = ({ lordsPrice }) => {
  return (
    <SeasonPassValue 
      lordsPrice={lordsPrice}
    />
  );
};

export default SeasonPassPage; 