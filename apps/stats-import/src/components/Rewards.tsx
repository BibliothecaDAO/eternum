import React, { useState, useEffect } from 'react';
import { EternumSocialData, Player, RewardsProps } from '../types';

const Rewards: React.FC<RewardsProps> = ({ lordsPrice }) => {
  const [eternumData, setEternumData] = useState<EternumSocialData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRewardType, setSelectedRewardType] = useState<'victory' | 'cartridge' | 'daydreams'>('victory');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'lords' | 'strk' | 'points' | 'name'>('lords');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchEternumData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/data/eternum-social-export.json');
        
        if (!response.ok) {
          throw new Error('Failed to fetch eternum data');
        }
        
        const data: EternumSocialData = await response.json();
        setEternumData(data);
      } catch (err) {
        console.error('Error fetching eternum data:', err);
        setError('Failed to load rewards data');
      } finally {
        setLoading(false);
      }
    };

    fetchEternumData();
  }, []);

  const formatLords = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatUSD = (lords: number): string => {
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

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  const renderRewardTypeContent = () => {
    switch (selectedRewardType) {
      case 'victory':
        return renderVictoryPrizes();
      case 'cartridge':
        return (
          <div className="rewards-placeholder">
            <h3>🎮 Cartridge Achievement Prizes</h3>
            <p>Coming soon...</p>
          </div>
        );
      case 'daydreams':
        return (
          <div className="rewards-placeholder">
            <h3>🤖 Daydreams Agents Prizes</h3>
            <p>Coming soon...</p>
          </div>
        );
      default:
        return null;
    }
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
              Season rewards for {eternumData.gameInfo.totalPlayers.toLocaleString()} players across {eternumData.gameInfo.totalTribes} tribes
            </p>
          </div>
          
          <div className="victory-summary">
            <div className="summary-card">
              <div className="summary-label">Total LORDS</div>
              <div className="summary-value">{formatLords(totalRewards.totalLords)}</div>
              <div className="summary-usd">{formatUSD(totalRewards.totalLords)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total STRK</div>
              <div className="summary-value">{formatStark(totalRewards.totalStrk)}</div>
            </div>
          </div>
        </div>

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
                    {player.isOwner && <span className="owner-badge">👑</span>}
                  </div>
                  <div className="tribe-rank">Rank #{player.tribeRank}</div>
                  <div className="tribe-prize">
                    Tribe Pool: {formatLords(player.tribePrize.lords)} LORDS / {formatStark(player.tribePrize.strk)} STRK
                  </div>
                </div>
                
                <div className="player-rewards">
                  <div className="reward-item">
                    <span className="reward-amount">{formatLords(player.totalLordsReward)} LORDS</span>
                    <span className="reward-usd">{formatUSD(player.totalLordsReward)}</span>
                  </div>
                  <div className="reward-item">
                    <span className="reward-amount">{formatStark(player.totalStrkReward)} STRK</span>
                  </div>
                </div>
                
                <div className="reward-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Member Share:</span>
                    <span className="breakdown-value">
                      {formatLords(player.rewards.memberShare)} LORDS / {formatStark(player.rewards.memberShareStrk)} STRK
                    </span>
                  </div>
                  {player.isOwner && (
                    <div className="breakdown-item owner-bonus">
                      <span className="breakdown-label">Owner Bonus:</span>
                      <span className="breakdown-value">
                        {formatLords(player.rewards.ownerBonus)} LORDS / {formatStark(player.rewards.ownerBonusStrk)} STRK
                      </span>
                    </div>
                  )}
                  <div className="breakdown-item">
                    <span className="breakdown-label">Points Share:</span>
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
