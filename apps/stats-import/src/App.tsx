import React, { useState, useEffect } from 'react';
import './App.css';
import PriceHeader from './components/PriceHeader';
import RevenueChart from './components/RevenueChart';
import FeeTable from './components/FeeTable';
import Rewards from './components/Rewards';
import { RevenueData, LordsApiResponse } from './types';

function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'revenue' | 'rewards'>('revenue');
  const [lordsPrice, setLordsPrice] = useState<number>(0);
  const [strkPrice, setStrkPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const fetchPrices = async (): Promise<void> => {
    try {
      setLoading(true);
      setPriceError(null);
      
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=lords,starknet&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true'
      );
      const data: LordsApiResponse = await response.json();
      
      if (data.lords && data.starknet) {
        setLordsPrice(data.lords.usd);
        setStrkPrice(data.starknet.usd);
        setPriceChange(data.lords.usd_24h_change);
        setLastUpdated(new Date(data.lords.last_updated_at * 1000));
      } else {
        throw new Error('Price data not found');
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
      setPriceError('Failed to load price data');
      // Fallback values if API fails
      setLordsPrice(0.02);
      setStrkPrice(1.15);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    
    // Refresh prices every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const revenueData: RevenueData[] = [
    {
      category: 'Village Passes',
      description: 'Direct village NFT sales revenue',
      amount: 316000,
      percentage: 56.8,
      address: 'No specific address',
      source: 'Paid in USD: $6,320 (1,264 villages × $5 each)',
      breakdown: `Equivalent to 316,000 LORDS at $${lordsPrice.toFixed(6)} per token`
    },
    {
      category: 'Donkey Network Fees',
      description: 'Main bridge infrastructure operations',
      amount: 162482,
      percentage: 29.2,
      address: '0x01d490c9345ae1fc0c10c8fd69f6a9f31f893ba7486eae489b020eea1f8a8ef7',
      source: 'Bridge operations + remaining LORDS tokens',
      breakdown: 'Core bridge infrastructure fees'
    },
    {
      category: 'Daydreams Agent Prize Pool',
      description: 'Portion of the prize pool planned for AI agent rewards',
      amount: 250000,
      percentage: 31.2,
      address: '0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5',
      source: 'Portion of the prize pool planned for AI agent rewards',
      breakdown: 'Distributed to veLORDS stakers'
    },
    {
      category: 'Bridge Fees',
      description: 'Bridge commissions and distributions',
      amount: 55282,
      percentage: 9.9,
      address: 'Multiple wallets',
      source: '7.5% commission distributed across multiple wallets',
      breakdown: `• Season Pool: 18,637 LORDS
• VeLords Bridge Fees: 18,637 LORDS  
• Client Integration: 18,008 LORDS`
    },
    {
      category: 'Marketplace Fees',
      description: 'Trading volume commissions',
      amount: 22487,
      percentage: 4.0,
      address: '0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5',
      source: '5% commission on marketplace trading volume',
      breakdown: 'Distributed to VeLords stakers'
    }
  ];

  const totalLords: number = revenueData.reduce((sum, item) => sum + item.amount, 0);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'revenue':
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
      case 'rewards':
        return (
          <Rewards 
            lordsPrice={lordsPrice}
            strkPrice={strkPrice}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <PriceHeader 
        lordsPrice={lordsPrice}
        priceChange={priceChange}
        lastUpdated={lastUpdated}
        loading={loading}
        error={priceError}
        totalLords={totalLords}
      />
      
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
          aria-label="View revenue analytics"
        >
          <span className="tab-icon">📊</span>
          <span className="tab-text">Revenue</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'rewards' ? 'active' : ''}`}
          onClick={() => setActiveTab('rewards')}
          aria-label="View rewards information"
        >
          <span className="tab-icon">🏆</span>
          <span className="tab-text">Rewards</span>
        </button>
      </div>
      
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default App; 