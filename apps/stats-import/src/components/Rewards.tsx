import React, { useState, useEffect } from 'react';
import { EternumSocialData, Player, RewardsProps, AchievementPlayer, CartridgeReward, DaydreamsReward, KnownAddresses } from '../types';

const Rewards: React.FC<RewardsProps> = ({ lordsPrice, strkPrice }) => {
  const [eternumData, setEternumData] = useState<EternumSocialData | null>(null);
  const [achievementsData, setAchievementsData] = useState<AchievementPlayer[] | null>(null);
  const [knownAddresses, setKnownAddresses] = useState<KnownAddresses | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRewardType, setSelectedRewardType] = useState<'victory' | 'cartridge' | 'daydreams'>('victory');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'lords' | 'strk' | 'points' | 'name'>('lords');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCalculations, setShowCalculations] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [eternumResponse, achievementsResponse, knownAddressesResponse] = await Promise.all([
          fetch('/data/eternum-social-export.json'),
          fetch('/data/achievements-eternum-s1.json'),
          fetch('/data/known-addresses.json')
        ]);
        
        if (!eternumResponse.ok || !achievementsResponse.ok || !knownAddressesResponse.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const eternumData: EternumSocialData = await eternumResponse.json();
        const achievementsData: AchievementPlayer[] = await achievementsResponse.json();
        const knownAddressesData: KnownAddresses = await knownAddressesResponse.json();
        
        setEternumData(eternumData);
        setAchievementsData(achievementsData);
        setKnownAddresses(knownAddressesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load rewards data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatLords = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatLordsUSD = (lords: number): string => {
    const usdValue = lords * lordsPrice;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(usdValue);
  };

  const formatStark = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatStrkUSD = (strk: number): string => {
    const usdValue = strk * strkPrice;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(usdValue);
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getPlayerName = (address: string): string | null => {
    if (!knownAddresses) return null;
    
    try {
      // Convert hex address to bigint string
      const addressBigInt = BigInt(address).toString();
      return knownAddresses[addressBigInt] || null;
    } catch (error) {
      console.warn('Error converting address to bigint:', address, error);
      return null;
    }
  };

  const getDisplayName = (address: string): string => {
    const playerName = getPlayerName(address);
    return playerName || formatAddress(address);
  };

  const calculateCartridgeRewards = (): CartridgeReward[] => {
    if (!achievementsData) return [];

    // Calculate total earnings across all players
    const totalEarnings = achievementsData.reduce((sum, player) => sum + player.earnings, 0);
    const totalPayout = 300000; // 300,000 LORDS

    return achievementsData.map(player => ({
      address: player.address,
      earnings: player.earnings,
      percentage: (player.earnings / totalEarnings) * 100,
      lordsReward: (player.earnings / totalEarnings) * totalPayout
    }));
  };

  const calculateDaydreamsRewards = (): DaydreamsReward[] => {
    if (!achievementsData) return [];

    const NEXUS_SIX_ID = '0x4e455855535f534958';
    const totalPayout = 25000; // 25,000 STRK

    // Find all players who completed the NEXUS_SIX achievement
    const qualifiedPlayers = achievementsData.filter(player => 
      player.completeds.includes(NEXUS_SIX_ID)
    );

    if (qualifiedPlayers.length === 0) return [];

    const rewardPerPlayer = totalPayout / qualifiedPlayers.length;

    return qualifiedPlayers.map(player => ({
      address: player.address,
      strkReward: rewardPerPlayer
    }));
  };

  const getAllPlayers = (): (Player & { tribeName: string; tribeRank: number; tribePrize: { lords: number; strk: number } })[] => {
    if (!eternumData) return [];

    const allPlayers: (Player & { tribeName: string; tribeRank: number; tribePrize: { lords: number; strk: number } })[] = [];

    eternumData.tribes.forEach((tribe) => {
      tribe.members.forEach((player) => {
        allPlayers.push({
          ...player,
          tribeName: tribe.name,
          tribeRank: tribe.rank,
          tribePrize: tribe.prize,
        });
      });
    });

    return allPlayers;
  };

  const getFilteredAndSortedPlayers = () => {
    let players = getAllPlayers();

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      players = players.filter(
        (player) =>
          player.name.toLowerCase().includes(search) ||
          player.address.toLowerCase().includes(search) ||
          player.tribeName.toLowerCase().includes(search)
      );
    }

    // Sort players
    players.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'lords':
          aValue = a.totalLordsReward;
          bValue = b.totalLordsReward;
          break;
        case 'strk':
          aValue = a.totalStrkReward;
          bValue = b.totalStrkReward;
          break;
        case 'points':
          aValue = a.points;
          bValue = b.points;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          aValue = a.totalLordsReward;
          bValue = b.totalLordsReward;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return players;
  };

  const getTotalRewards = () => {
    if (!eternumData) return { totalLords: 0, totalStrk: 0 };

    const totals = eternumData.tribes.reduce(
      (acc, tribe) => ({
        totalLords: acc.totalLords + tribe.prize.lords,
        totalStrk: acc.totalStrk + tribe.prize.strk,
      }),
      { totalLords: 0, totalStrk: 0 }
    );

    return totals;
  };

  const renderCalculationExplanation = () => {
    if (!eternumData) return null;

    return (
      <div className="calculation-explanation">
        <div className="calculation-header">
          <button
            className="calculation-toggle"
            onClick={() => setShowCalculations(!showCalculations)}
            aria-expanded={showCalculations}
          >
            <span className="calculation-icon">{showCalculations ? '📊' : '🧮'}</span>
            <span className="calculation-title">How Victory Prizes Are Calculated</span>
            <span className="calculation-arrow">
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12"
              >
                <path 
                  d="M4 2L8 6L4 10" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  fill="none" 
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>
        </div>
        
        {showCalculations && (
          <div className="calculation-content">
            <div className="calculation-grid">
              <div className="calculation-card">
                <div className="calc-card-header">
                  <span className="calc-icon">🏆</span>
                  <h4>Tribe Prize Pools</h4>
                </div>
                <div className="calc-card-content">
                  <p>Each tribe receives a prize pool based on their final ranking:</p>
                  <ul className="calc-list">
                    <li>1st Place: 30% of total prize pool</li>
                    <li>2nd Place: 18% of total prize pool</li>
                    <li>3rd Place: 12% of total prize pool</li>
                    <li>4th Place: 9% of total prize pool</li>
                    <li>5th Place: 7% of total prize pool</li>
                    <li>6th Place: 6% of total prize pool</li>
                    <li>7th & 8th Place: 5% each of total prize pool</li>
                    <li>9th & 10th Place: 4% each of total prize pool</li>
                  </ul>
                </div>
              </div>

              <div className="calculation-card">
                <div className="calc-card-header">
                  <span className="calc-icon">👥</span>
                  <h4>Member Share Distribution</h4>
                </div>
                <div className="calc-card-content">
                  <p>70% of each tribe's prize pool is distributed among members based on their contribution:</p>
                  <div className="calc-formula">
                    <div className="formula-line">
                      <span className="formula-label">Member Share =</span>
                      <span className="formula-value">(Player Points ÷ Total Tribe Points) × 70% × Tribe Prize</span>
                    </div>
                  </div>
                  <p className="calc-note">Your reward is proportional to your points contribution to the tribe's success.</p>
                </div>
              </div>

              <div className="calculation-card">
                <div className="calc-card-header">
                  <span className="calc-icon">👑</span>
                  <h4>Tribe Owner Bonus</h4>
                </div>
                <div className="calc-card-content">
                  <p>Tribe owners receive an additional 30% bonus on top of their member share:</p>
                  <div className="calc-formula">
                    <div className="formula-line">
                      <span className="formula-label">Owner Bonus =</span>
                      <span className="formula-value">30% × Tribe Prize Pool</span>
                    </div>
                    <div className="formula-line">
                      <span className="formula-label">Total Owner Reward =</span>
                      <span className="formula-value">Member Share + Owner Bonus</span>
                    </div>
                  </div>
                  <p className="calc-note">Owners can distribute this bonus to themselves or other tribe members.</p>
                </div>
              </div>

            </div>

            <div className="calculation-example">
              <div className="example-header">
                <span className="example-icon">💡</span>
                <h4>Example Calculation</h4>
              </div>
              <div className="example-content">
                <div className="example-scenario">
                  <p><strong>Scenario:</strong> Player "Alice" in the #1 ranked tribe "FOCG BOIS"</p>
                  <div className="example-data">
                    <div className="data-row">
                      <span className="data-label">Tribe Prize Pool:</span>
                      <span className="data-value">90,000 LORDS + 15,000 STRK</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Alice's Points:</span>
                      <span className="data-value">500,000 points</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Total Tribe Points:</span>
                      <span className="data-value">10,000,000 points</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Alice's Share:</span>
                      <span className="data-value">500,000 ÷ 10,000,000 = 5%</span>
                    </div>
                  </div>
                  <div className="example-calculation">
                    <div className="calc-step">
                      <span className="step-label">Member Pool (70%):</span>
                      <span className="step-value">63,000 LORDS + 10,500 STRK</span>
                    </div>
                    <div className="calc-step">
                      <span className="step-label">Alice's Member Share:</span>
                      <span className="step-value">5% × 63,000 = 3,150 LORDS</span>
                    </div>
                    <div className="calc-step highlight">
                      <span className="step-label">Alice's Final Reward:</span>
                      <span className="step-value">3,150 LORDS ({formatLordsUSD(3150)}) + 525 STRK ({formatStrkUSD(525)})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRewardTypeContent = () => {
    switch (selectedRewardType) {
      case 'victory':
        return renderVictoryPrizes();
      case 'cartridge':
        return renderCartridgePrizes();
      case 'daydreams':
        return renderDaydreamsPrizes();
      default:
        return null;
    }
  };

  const renderCartridgePrizes = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading cartridge achievement prizes...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <p className="error-message">{error}</p>
        </div>
      );
    }

    if (!achievementsData) {
      return <div className="error-state">No achievements data available</div>;
    }

    const cartridgeRewards = calculateCartridgeRewards();
    const filteredRewards = cartridgeRewards.filter(reward => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const playerName = getPlayerName(reward.address);
      return reward.address.toLowerCase().includes(search) || 
             (playerName && playerName.toLowerCase().includes(search));
    });

    // Sort the rewards
    filteredRewards.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'lords':
          aValue = a.lordsReward;
          bValue = b.lordsReward;
          break;
        case 'points':
          aValue = a.earnings;
          bValue = b.earnings;
          break;
        case 'name':
          aValue = getDisplayName(a.address).toLowerCase();
          bValue = getDisplayName(b.address).toLowerCase();
          break;
        default:
          aValue = a.lordsReward;
          bValue = b.lordsReward;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return (
      <div className="cartridge-prizes">
        <div className="cartridge-header">
          <div className="cartridge-title">
            <h3>🎮 Cartridge Achievement Prizes</h3>
            <p className="cartridge-subtitle">
              300,000 LORDS distributed based on achievement points earned by {cartridgeRewards.length} players
            </p>
          </div>
          
          <div className="cartridge-summary">
            <div className="summary-card">
              <div className="summary-label">Total Prize Pool</div>
              <div className="summary-value">300,000 LORDS</div>
              <div className="summary-usd">{formatLordsUSD(300000)}</div>
            </div>
          </div>
        </div>

        <div className="cartridge-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by player name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="sort-controls">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'lords' | 'strk' | 'points' | 'name')}
              className="sort-select"
            >
              <option value="lords">Sort by LORDS</option>
              <option value="points">Sort by Points</option>
              <option value="name">Sort by Name</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="sort-order-btn"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="cartridge-table">
          <div className="table-header">
            <div className="header-player">Player</div>
            <div className="header-points">Achievement Points</div>
            <div className="header-percentage">Share %</div>
            <div className="header-rewards">LORDS Reward</div>
          </div>
          
          <div className="table-body">
            {filteredRewards.map((reward, index) => (
              <div key={`${reward.address}-${index}`} className="player-row">
                <div className="player-info">
                  {getPlayerName(reward.address) ? (
                    <>
                      <div className="player-name">{getPlayerName(reward.address)}</div>
                      <div className="player-address">{reward.address}</div>
                    </>
                  ) : (
                    <div className="player-address-only">{reward.address}</div>
                  )}
                </div>
                
                <div className="points-info">
                  <div className="points-value">{reward.earnings.toLocaleString()}</div>
                  <div className="points-label">points</div>
                </div>
                
                <div className="percentage-info">
                  <div className="percentage-value">{reward.percentage.toFixed(4)}%</div>
                </div>
                
                <div className="reward-info">
                  <div className="reward-amount">{formatLords(reward.lordsReward)} LORDS</div>
                  <div className="reward-usd">{formatLordsUSD(reward.lordsReward)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDaydreamsPrizes = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading daydreams agent prizes...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <p className="error-message">{error}</p>
        </div>
      );
    }

    if (!achievementsData) {
      return <div className="error-state">No achievements data available</div>;
    }

    const daydreamsRewards = calculateDaydreamsRewards();
    const filteredRewards = daydreamsRewards.filter(reward => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const playerName = getPlayerName(reward.address);
      return reward.address.toLowerCase().includes(search) || 
             (playerName && playerName.toLowerCase().includes(search));
    });

    // Sort the rewards
    filteredRewards.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'strk':
          aValue = a.strkReward;
          bValue = b.strkReward;
          break;
        case 'name':
          aValue = getDisplayName(a.address).toLowerCase();
          bValue = getDisplayName(b.address).toLowerCase();
          break;
        default:
          aValue = a.strkReward;
          bValue = b.strkReward;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return (
      <div className="daydreams-prizes">
        <div className="daydreams-header">
          <div className="daydreams-title">
            <h3>🤖 Daydreams Agent Slayer Prizes</h3>
            <p className="daydreams-subtitle">
              25,000 STRK equally distributed among {daydreamsRewards.length} players who completed the NEXUS-6 achievement (killed 10 AI agents)
            </p>
          </div>
          
          <div className="daydreams-summary">
            <div className="summary-card">
              <div className="summary-label">Total Prize Pool</div>
              <div className="summary-value">25,000 STRK</div>
              <div className="summary-usd">{formatStrkUSD(25000)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Per Player</div>
              <div className="summary-value">{daydreamsRewards.length > 0 ? formatStark(daydreamsRewards[0].strkReward) : '0'} STRK</div>
              <div className="summary-usd">{daydreamsRewards.length > 0 ? formatStrkUSD(daydreamsRewards[0].strkReward) : '$0'}</div>
            </div>
          </div>
        </div>

        <div className="daydreams-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by player name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="sort-controls">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'lords' | 'strk' | 'points' | 'name')}
              className="sort-select"
            >
              <option value="strk">Sort by STRK</option>
              <option value="name">Sort by Name</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="sort-order-btn"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="daydreams-table">
          <div className="table-header">
            <div className="header-player">Player</div>
            <div className="header-achievement">Achievement</div>
            <div className="header-rewards">STRK Reward</div>
          </div>
          
          <div className="table-body">
            {filteredRewards.map((reward, index) => (
              <div key={`${reward.address}-${index}`} className="player-row">
                <div className="player-info">
                  {getPlayerName(reward.address) ? (
                    <>
                      <div className="player-name">{getPlayerName(reward.address)}</div>
                      <div className="player-address">{reward.address}</div>
                    </>
                  ) : (
                    <div className="player-address-only">{reward.address}</div>
                  )}
                </div>
                
                <div className="achievement-info">
                  <div className="achievement-name">🤖 NEXUS-6</div>
                  <div className="achievement-description">Killed 10 AI Agents</div>
                </div>
                
                <div className="reward-info">
                  <div className="reward-amount">{formatStark(reward.strkReward)} STRK</div>
                  <div className="reward-usd">{formatStrkUSD(reward.strkReward)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderVictoryPrizes = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading victory prizes...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <p className="error-message">{error}</p>
        </div>
      );
    }

    if (!eternumData) {
      return <div className="error-state">No data available</div>;
    }

    const players = getFilteredAndSortedPlayers();
    const totalRewards = getTotalRewards();

    return (
      <div className="victory-prizes">
        <div className="victory-header">
          <div className="victory-title">
            <h3>🏆 Victory Prizes Distribution</h3>
            <p className="victory-subtitle">
              Season 1 rewards for players across {eternumData.gameInfo.totalTribes} tribes
            </p>
          </div>
          
          <div className="victory-summary">
            <div className="summary-card">
              <div className="summary-label">Total LORDS</div>
              <div className="summary-value">{formatLords(totalRewards.totalLords)}</div>
              <div className="summary-usd">{formatLordsUSD(totalRewards.totalLords)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total STRK</div>
              <div className="summary-value">{formatStark(totalRewards.totalStrk)}</div>
              <div className="summary-usd">{formatStrkUSD(totalRewards.totalStrk)}</div>
            </div>
          </div>
        </div>

        {renderCalculationExplanation()}

        <div className="victory-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by player name, address, or tribe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="sort-controls">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'lords' | 'strk' | 'points' | 'name')}
              className="sort-select"
            >
              <option value="lords">Sort by LORDS</option>
              <option value="strk">Sort by STRK</option>
              <option value="points">Sort by Points</option>
              <option value="name">Sort by Name</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="sort-order-btn"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="players-table">
          <div className="table-header">
            <div className="header-player">Player</div>
            <div className="header-tribe">Tribe</div>
            <div className="header-rewards">Rewards</div>
            <div className="header-breakdown">Breakdown</div>
          </div>
          
          <div className="table-body">
            {players.map((player, index) => (
              <div key={`${player.address}-${index}`} className="player-row">
                <div className="player-info">
                  <div className="player-name">{player.name}</div>
                  <div className="player-address">{formatAddress(player.address)}</div>
                  <div className="player-stats">
                    {player.points.toLocaleString()} pts • {player.realms} realms
                  </div>
                </div>
                
                <div className="tribe-info">
                  <div className="tribe-name">
                    {player.tribeName}
                  </div>
                  <div className="tribe-rank">Rank #{player.tribeRank}</div>
                  <div className="tribe-prize">
                    Tribe Pool: {formatLords(player.tribePrize.lords)} LORDS ({formatLordsUSD(player.tribePrize.lords)}) / {formatStark(player.tribePrize.strk)} STRK ({formatStrkUSD(player.tribePrize.strk)})
                  </div>
                </div>
                
                <div className="player-rewards">
                  <div className="reward-item">
                    <span className="reward-amount">{formatLords(player.totalLordsReward)} LORDS</span>
                    <span className="reward-usd">{formatLordsUSD(player.totalLordsReward)}</span>
                  </div>
                  <div className="reward-item">
                    <span className="reward-amount">{formatStark(player.totalStrkReward)} STRK</span>
                    <span className="reward-usd">{formatStrkUSD(player.totalStrkReward)}</span>
                  </div>
                </div>
                
                <div className="reward-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Member Share:</span>
                    <span className="breakdown-value">
                      {formatLords(player.rewards.memberShare)} LORDS ({formatLordsUSD(player.rewards.memberShare)}) / {formatStark(player.rewards.memberShareStrk)} STRK ({formatStrkUSD(player.rewards.memberShareStrk)})
                    </span>
                  </div>
                  {player.isOwner && (
                    <div className="breakdown-item owner-bonus">
                      <span className="breakdown-label">Owner Bonus:</span>
                      <span className="breakdown-value">
                        {formatLords(player.rewards.ownerBonus)} LORDS ({formatLordsUSD(player.rewards.ownerBonus)}) / {formatStark(player.rewards.ownerBonusStrk)} STRK ({formatStrkUSD(player.rewards.ownerBonusStrk)})
                      </span>
                    </div>
                  )}
                  <div className="breakdown-item">
                    <span className="breakdown-label">Tribe Points Share:</span>
                    <span className="breakdown-value">{(player.pointsShare * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rewards-container">
      <div className="rewards-nav">
        <button
          className={`reward-type-btn ${selectedRewardType === 'victory' ? 'active' : ''}`}
          onClick={() => setSelectedRewardType('victory')}
        >
          🏆 Victory Prizes
        </button>
        <button
          className={`reward-type-btn ${selectedRewardType === 'cartridge' ? 'active' : ''}`}
          onClick={() => setSelectedRewardType('cartridge')}
        >
          🎮 Cartridge Achievements
        </button>
        <button
          className={`reward-type-btn ${selectedRewardType === 'daydreams' ? 'active' : ''}`}
          onClick={() => setSelectedRewardType('daydreams')}
        >
          🤖 Daydreams Agents
        </button>
      </div>
      
      <div className="rewards-content">
        {renderRewardTypeContent()}
      </div>
    </div>
  );
};

export default Rewards;
