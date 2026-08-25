import React from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import './App.css';
import PriceHeader from './components/PriceHeader';
import RevenuePage from './pages/RevenuePage';
import RewardsPage from './pages/RewardsPage';
import SeasonPassPage from './pages/SeasonPassPage';
import { RevenueData } from './types';
import { Analytics } from "@vercel/analytics/react"

const S1_LORDS_PRICE_USD = 0.02;
const S1_STRK_PRICE_USD = 0.125;
const VILLAGES_SOLD = 1156;
const VILLAGE_PRICE_USD = 5;
const DAYDREAMS_AGENTS_KILLED = 1019;
const AVG_LORDS_PER_AGENT = 22.5;
const DAYDREAMS_AGENTS_LORDS = DAYDREAMS_AGENTS_KILLED * AVG_LORDS_PER_AGENT;
const AMOUNT_LEFT_IN_BRIDGE_CONTRACT = 151412;

function App(): React.JSX.Element {
  const location = useLocation();
  const lordsPrice = S1_LORDS_PRICE_USD;
  const strkPrice = S1_STRK_PRICE_USD;

  const villageRevenueUSD = VILLAGES_SOLD * VILLAGE_PRICE_USD;
  const villageRevenueLords = villageRevenueUSD / lordsPrice;

  const revenueData: RevenueData[] = [
    {
      category: 'Village Passes',
      description: 'Direct village NFT sales revenue',
      amount: villageRevenueLords,
      percentage: 56.8,
      address: 'No specific address',
      source: `Paid in USD: $${villageRevenueUSD.toLocaleString()} (${VILLAGES_SOLD.toLocaleString()} villages × $${VILLAGE_PRICE_USD} each)`,
      breakdown: `Equivalent to ${villageRevenueLords.toLocaleString()} LORDS at $${lordsPrice.toFixed(2)} per token (S1 close price)`
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
    if (path.startsWith('/rewards')) return 'rewards';
    if (path === '/seasonpass') return 'seasonpass';
    return 'revenue';
  };

  return (
    <div className="App">
      <PriceHeader 
        lordsPrice={lordsPrice}
        priceChange={null}
        lastUpdated={null}
        loading={false}
        error={null}
        priceNote="S1 close price"
        totalLords={totalLords}
      />
      
      <div className="tab-navigation">
        <Link
          to="/"
          className={`tab-button ${getCurrentTab() === 'revenue' ? 'active' : ''}`}
          aria-label="View revenue analytics"
        >
          <span className="tab-text">Revenue</span>
        </Link>
        <Link
          to="/seasonpass"
          className={`tab-button ${getCurrentTab() === 'seasonpass' ? 'active' : ''}`}
          aria-label="View season pass value analysis"
        >
          <span className="tab-text">Season Pass</span>
        </Link>
        <Link
          to="/rewards"
          className={`tab-button ${getCurrentTab() === 'rewards' ? 'active' : ''}`}
          aria-label="View rewards information"
        >
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
          <Route path="/rewards/:tab" element={
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