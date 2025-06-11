import React, { useState, useEffect } from 'react';

interface MarketplaceSale {
  hex_price: string;
}

interface SeasonPassValueProps {
  lordsPrice: number;
}

const SeasonPassValue: React.FC<SeasonPassValueProps> = ({ lordsPrice }) => {
  const [marketplaceData, setMarketplaceData] = useState<MarketplaceSale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Constants - Updated with correct numbers
  const TOTAL_REALMS_NFTS = 8000; // Total Realms NFTs (Ethereum + Starknet)
  const REALMS_BRIDGED_TO_STARKNET = 5106; // Realms NFTs bridged to Starknet
  const SEASON_PASSES_MINTED = 3614; // Season passes minted for Realms holders
  const SEASON_PASSES_USED = 2173; // Season passes actually used in the game
  const WEI_PER_LORDS = 1e18; // 18 decimals

  useEffect(() => {
    const fetchMarketplaceData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/data/marketplace-sales.json');
        if (!response.ok) {
          throw new Error('Failed to fetch marketplace data');
        }
        
        const data: MarketplaceSale[] = await response.json();
        setMarketplaceData(data);
      } catch (err) {
        console.error('Error fetching marketplace data:', err);
        setError('Failed to load marketplace data');
      } finally {
        setLoading(false);
      }
    };

    fetchMarketplaceData();
  }, []);

  // Convert hex price to LORDS amount
  const hexToLords = (hexPrice: string): number => {
    // Remove '0x' prefix and convert to BigInt, then to number
    const weiAmount = BigInt(hexPrice);
    // Convert from wei to LORDS (divide by 1e18)
    return Number(weiAmount) / WEI_PER_LORDS;
  };

  // Calculate statistics
  const calculateStats = () => {
    if (marketplaceData.length === 0) {
      return {
        totalSoldOnMarketplace: 0,
        lordsAmounts: [],
        totalRevenue: 0,
        averagePrice: 0,
        scenarios: []
      };
    }

    const lordsAmounts = marketplaceData.map(sale => hexToLords(sale.hex_price));
    const totalSoldOnMarketplace = lordsAmounts.length;
    const totalRevenue = lordsAmounts.reduce((sum, amount) => sum + amount, 0);
    const averagePrice = totalRevenue / totalSoldOnMarketplace;
    
    // Calculate different scenarios for added value
    const scenarios = [
      {
        id: 'used',
        title: 'Season Passes Used in Game',
        description: 'Value of season passes actually used during Season 1',
        count: SEASON_PASSES_USED,
        value: SEASON_PASSES_USED * averagePrice,
        explanation: 'Based on the 2,173 season passes that were actively used in the game'
      },
      {
        id: 'minted',
        title: 'Season Passes Minted',
        description: 'Value of all season passes minted for Realms holders',
        count: SEASON_PASSES_MINTED,
        value: SEASON_PASSES_MINTED * averagePrice,
        explanation: 'Based on the 3,614 season passes that were actually minted for Realms NFT holders'
      },
      {
        id: 'bridged',
        title: 'Realms Bridged to Starknet',
        description: 'Potential value if all bridged Realms got season passes',
        count: REALMS_BRIDGED_TO_STARKNET,
        value: REALMS_BRIDGED_TO_STARKNET * averagePrice,
        explanation: 'Theoretical value if all 5,106 Realms bridged to Starknet had claimed season passes'
      },
      {
        id: 'total',
        title: 'All Realms NFTs',
        description: 'Maximum theoretical value across all Realms',
        count: TOTAL_REALMS_NFTS,
        value: TOTAL_REALMS_NFTS * averagePrice,
        explanation: 'Maximum theoretical value if all 8,000 Realms NFTs (Ethereum + Starknet) had received season passes'
      }
    ];

    return {
      totalSoldOnMarketplace,
      lordsAmounts,
      totalRevenue,
      averagePrice,
      scenarios
    };
  };

  const stats = calculateStats();

  const formatLords = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(Math.round(amount));
  };

  const formatLordsDetailed = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatUSD = (lordsAmount: number): string => {
    const usdValue = lordsAmount * lordsPrice;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(usdValue);
  };

  const formatUSDDetailed = (lordsAmount: number): string => {
    const usdValue = lordsAmount * lordsPrice;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(usdValue);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading season pass marketplace data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-state">
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Season Pass Value Analysis</h1>
      
      <div className="season-pass-analysis">
        <div className="analysis-header">
          <div className="header-stats">
            <div className="stat-card primary">
              <div className="stat-label">Total Realms NFTs</div>
              <div className="stat-value">{TOTAL_REALMS_NFTS.toLocaleString()}</div>
              <div className="stat-subtitle">Ethereum + Starknet</div>
            </div>
            
            <div className="stat-card secondary">
              <div className="stat-label">Bridged to Starknet</div>
              <div className="stat-value">{REALMS_BRIDGED_TO_STARKNET.toLocaleString()}</div>
              <div className="stat-subtitle">{((REALMS_BRIDGED_TO_STARKNET / TOTAL_REALMS_NFTS) * 100).toFixed(1)}% of total</div>
            </div>
            
            <div className="stat-card secondary">
              <div className="stat-label">Season Passes Minted</div>
              <div className="stat-value">{SEASON_PASSES_MINTED.toLocaleString()}</div>
              <div className="stat-subtitle">{((SEASON_PASSES_MINTED / REALMS_BRIDGED_TO_STARKNET) * 100).toFixed(1)}% of bridged</div>
            </div>

            <div className="stat-card secondary">
              <div className="stat-label">Used in Game</div>
              <div className="stat-value">{SEASON_PASSES_USED.toLocaleString()}</div>
              <div className="stat-subtitle">{((SEASON_PASSES_USED / SEASON_PASSES_MINTED) * 100).toFixed(1)}% of minted</div>
            </div>
          </div>
        </div>

        <div className="marketplace-summary">
          <div className="analysis-card">
            <div className="card-header">
              <h3>💰 Marketplace Statistics</h3>
            </div>
            <div className="card-content">
              <div className="metric-row">
                <span className="metric-label">Average Sale Price:</span>
                <span className="metric-value">
                  {formatLordsDetailed(stats.averagePrice)} LORDS
                  <span className="metric-usd">({formatUSDDetailed(stats.averagePrice)})</span>
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Total Marketplace Revenue:</span>
                <span className="metric-value">
                  {formatLords(stats.totalRevenue)} LORDS
                  <span className="metric-usd">({formatUSD(stats.totalRevenue)})</span>
                </span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Total Sales Volume:</span>
                <span className="metric-value">{stats.totalSoldOnMarketplace.toLocaleString()} passes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="scenarios-section">
          <h3>📊 Value Creation Estimation</h3>
          <p className="scenarios-intro">
            All season passes were provided <strong>free</strong> to Realms NFT holders. 
            Here are different scenarios to estimate the total value created for Realms NFT holders using the average price of the marketplace sales:
          </p>
          
          <div className="scenarios-grid">
            {stats.scenarios.map((scenario, index) => (
              <div key={scenario.id} className={`scenario-card ${index === 0 ? 'highlight' : ''}`}>
                <div className="scenario-header">
                  <h4>{scenario.title}</h4>
                  <div className="scenario-count">{scenario.count.toLocaleString()}</div>
                </div>
                <div className="scenario-content">
                  <div className="scenario-value">
                    <div className="value-lords">{formatLords(scenario.value)} LORDS</div>
                    <div className="value-usd">{formatUSD(scenario.value)}</div>
                  </div>
                  <div className="scenario-description">{scenario.description}</div>
                  <div className="scenario-explanation">{scenario.explanation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonPassValue;
