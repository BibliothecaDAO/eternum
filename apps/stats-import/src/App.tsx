import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import './App.css';
import PriceHeader from './components/PriceHeader';
import RevenuePage from './pages/RevenuePage';
import RewardsPage from './pages/RewardsPage';
import SeasonPassPage from './pages/SeasonPassPage';
import { RevenueData, LordsApiResponse } from './types';
import { Analytics } from "@vercel/analytics/react"

const VILLAGES_SOLD = 1156;
const VILLAGE_PRICE_USD = 5;
const DAYDREAMS_AGENTS_KILLED = 1019;
const AVG_LORDS_PER_AGENT = 22.5;
const DAYDREAMS_AGENTS_LORDS = DAYDREAMS_AGENTS_KILLED * AVG_LORDS_PER_AGENT;
const AMOUNT_LEFT_IN_BRIDGE_CONTRACT = 151412;

function App(): React.JSX.Element {
  const location = useLocation();
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

  const villageRevenueUSD = VILLAGES_SOLD * VILLAGE_PRICE_USD;
  const villageRevenueLords = lordsPrice > 0 ? villageRevenueUSD / lordsPrice : 0;

  const revenueData: RevenueData[] = [
    {
      category: 'Village Passes',
      description: 'Direct village NFT sales revenue',
      amount: villageRevenueLords,
      percentage: 56.8,
      address: 'No specific address',
      source: `Paid in USD: $${villageRevenueUSD.toLocaleString()} (${VILLAGES_SOLD.toLocaleString()} villages × $${VILLAGE_PRICE_USD} each)`,
      breakdown: `Equivalent to ${villageRevenueLords.toLocaleString()} LORDS at $${lordsPrice.toFixed(6)} per token`
    },
    {
      category: 'Donkey Network Fees',
      description: 'Main bridge infrastructure operations + allocated agent rewards',
      amount: AMOUNT_LEFT_IN_BRIDGE_CONTRACT + DAYDREAMS_AGENTS_LORDS,
      percentage: 29.2,
      address: '0x01d490c9345ae1fc0c10c8fd69f6a9f31f893ba7486eae489b020eea1f8a8ef7',
      source: 'Donkey Network Fees + remaining LORDS tokens',
      breakdown: `${AMOUNT_LEFT_IN_BRIDGE_CONTRACT.toLocaleString()} LORDS left in the bridge contract + ${DAYDREAMS_AGENTS_LORDS.toLocaleString()} LORDS retrieved from Daydreams agents (${DAYDREAMS_AGENTS_KILLED} agents killed × ${AVG_LORDS_PER_AGENT} avg LORDS per agent)`
    },
    {
      category: 'Daydreams Agent Prize Pool',
      description: 'Remaining portion of the prize pool after agent rewards allocation',
      amount: 250000 - DAYDREAMS_AGENTS_LORDS,
      percentage: 31.2,
      address: 'No specific address',
      source: 'Prize pool minus allocated agent rewards',
      breakdown: `Distributed to veLORDS stakers after deducting ${DAYDREAMS_AGENTS_LORDS.toLocaleString()} LORDS for agent rewards`
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

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path === '/rewards') return 'rewards';
    if (path === '/seasonpass') return 'seasonpass';
    return 'revenue';
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
        <Link
          to="/"
          className={`tab-button ${getCurrentTab() === 'revenue' ? 'active' : ''}`}
          aria-label="View revenue analytics"
        >
          <span className="tab-icon">📊</span>
          <span className="tab-text">Revenue</span>
        </Link>
        <Link
          to="/seasonpass"
          className={`tab-button ${getCurrentTab() === 'seasonpass' ? 'active' : ''}`}
          aria-label="View season pass value analysis"
        >
          <span className="tab-icon">🎫</span>
          <span className="tab-text">Season Pass</span>
        </Link>
        <Link
          to="/rewards"
          className={`tab-button ${getCurrentTab() === 'rewards' ? 'active' : ''}`}
          aria-label="View rewards information"
        >
          <span className="tab-icon">🏆</span>
          <span className="tab-text">Rewards</span>
        </Link>
      </div>
      
      <div className="tab-content">
        <Routes>
          <Route path="/" element={
            <RevenuePage
              revenueData={revenueData}
              lordsPrice={lordsPrice}
              totalLords={totalLords}
            />
          } />
          <Route path="/rewards" element={
            <RewardsPage
              lordsPrice={lordsPrice}
              strkPrice={strkPrice}
            />
          } />
          <Route path="/seasonpass" element={
            <SeasonPassPage
              lordsPrice={lordsPrice}
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Analytics />
    </div>
  );
}

export default App; 