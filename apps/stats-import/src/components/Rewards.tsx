import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EternumSocialData, Player, RewardsProps, AchievementPlayer, CartridgeReward, DaydreamsReward, KnownAddresses, ChestReward, ChestRewardsData, ChestBracket } from '../types';

const padAddress = (address: string): string => {
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  return `0x${cleanAddress.padStart(64, '0')}`;
};

const Rewards: React.FC<RewardsProps> = ({ lordsPrice, strkPrice, initialTab }) => {
  const STRK_PRICE_NOTE = '* at S1 close price of $0.125';
  const navigate = useNavigate();
  const [eternumData, setEternumData] = useState<EternumSocialData | null>(null);
  const [cartridgePoints, setCartridgePoints] = useState<{ player_id: string; total_points: number }[] | null>(null);
  const [knownAddresses, setKnownAddresses] = useState<KnownAddresses | null>(null);
  const [nexus6Players, setNexus6Players] = useState<{ player_id: string; total_points: number }[] | null>(null);
  const [chestRewards, setChestRewards] = useState<ChestReward[] | null>(null);
  const [chestBrackets, setChestBrackets] = useState<ChestBracket[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRewardType, setSelectedRewardType] = useState<'victory' | 'cartridge' | 'daydreams' | 'chests'>(initialTab || 'victory');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'lords' | 'strk' | 'points' | 'name'>('lords');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleTabChange = (tab: 'victory' | 'cartridge' | 'daydreams' | 'chests') => {
    setSelectedRewardType(tab);
    navigate(`/rewards/${tab}`);
  };

  useEffect(() => {
    setSelectedRewardType(initialTab || 'victory');
  }, [initialTab]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [eternumResponse, cartridgeResponse, knownAddressesResponse, nexus6Response, chestResponse] = await Promise.all([
          fetch('/data/eternum-social-export.json'),
          fetch('/data/cartridge-points.json'),
          fetch('/data/known-addresses.json'),
          fetch('/data/nexus-6-players.json'),
          fetch('/data/chest-rewards.json').catch(() => ({ ok: false, json: () => [] }))
        ]);
        
        if (!eternumResponse.ok || !cartridgeResponse.ok || !knownAddressesResponse.ok || !nexus6Response.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const eternumData: EternumSocialData = await eternumResponse.json();
        const cartridgeData: { player_id: string; total_points: number }[] = await cartridgeResponse.json();
        const knownAddressesData: KnownAddresses = await knownAddressesResponse.json();
        const nexus6Data: { player_id: string; total_points: number }[] = await nexus6Response.json();
        const chestDataResponse: ChestRewardsData | ChestReward[] = chestResponse.ok ? await chestResponse.json() : [];
        
        // Handle both old format (array) and new format (object with brackets)
        let chestData: ChestReward[] = [];
        let bracketsData: ChestBracket[] | null = null;
        
        if (Array.isArray(chestDataResponse)) {
          // Old format - just an array of rewards
          chestData = chestDataResponse;
        } else {
          // New format - object with brackets and rewards
          chestData = chestDataResponse.rewards || [];
          bracketsData = chestDataResponse.brackets || null;
        }

        // Pad addresses in eternumData
        eternumData.tribes = eternumData.tribes.map(tribe => ({
          ...tribe,
          members: tribe.members.map(member => ({
            ...member,
            address: padAddress(member.address)
          }))
        }));

        // Pad addresses in cartridgeData
        const paddedCartridgeData = cartridgeData.map(player => ({
          ...player,
          player_id: padAddress(player.player_id)
        }));

        // Pad addresses in nexus6Data
        const paddedNexus6Data = nexus6Data.map(player => ({
          ...player,
          player_id: padAddress(player.player_id)
        }));

        // Pad addresses in chestData
        const paddedChestData = chestData.map(chest => ({
          ...chest,
          toAddress: padAddress(chest.toAddress)
        }));
    
        setEternumData(eternumData);
        setCartridgePoints(paddedCartridgeData);
        setKnownAddresses(knownAddressesData);
        setNexus6Players(paddedNexus6Data);
        setChestRewards(paddedChestData);
        setChestBrackets(bracketsData);
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
    const formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(usdValue);
    return `${formattedValue}*`;
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
    if (!cartridgePoints) return [];

    // Calculate total points across all players
    const totalPoints = cartridgePoints.reduce((sum, player) => sum + player.total_points, 0);
    const totalPayout = 300000; // 300,000 LORDS

    return cartridgePoints.map(player => ({
      address: player.player_id,
      earnings: player.total_points,
      percentage: (player.total_points / totalPoints) * 100,
      lordsReward: (player.total_points / totalPoints) * totalPayout
    }));
  };

  const calculateDaydreamsRewards = (): DaydreamsReward[] => {
    if (!nexus6Players) return [];

    const totalPayout = 25000; // 25,000 STRK
    const rewardPerPlayer = totalPayout / nexus6Players.length;

    return nexus6Players.map(player => ({
      address: player.player_id,
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

  const renderRewardTypeContent = () => {
    switch (selectedRewardType) {
      case 'victory':
        return renderVictoryPrizes();
      case 'cartridge':
        return renderCartridgePrizes();
      case 'daydreams':
        return renderDaydreamsPrizes();
      case 'chests':
        return renderChestRewards();
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

    if (!cartridgePoints) {
      return <div className="error-state">No cartridge points data available</div>;
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
            <h3>Cartridge Achievement Prizes</h3>
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

    if (!nexus6Players) {
      return <div className="error-state">No nexus-6 players data available</div>;
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
            <h3>Daydreams Agent Slayer Prizes</h3>
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


  const renderChestRewards = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading loot chest rewards...</p>
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

    if (!chestRewards || chestRewards.length === 0) {
      return (
        <div className="error-state">
          <p>No chest rewards data available. Please run the chest generation script first.</p>
        </div>
      );
    }

    const filteredRewards = chestRewards.filter(reward => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const playerName = getPlayerName(reward.toAddress);
      return reward.toAddress.toLowerCase().includes(search) || 
             (playerName && playerName.toLowerCase().includes(search));
    });

    // Sort the rewards
    filteredRewards.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case 'points':
          aValue = a.count;
          bValue = b.count;
          break;
        case 'name':
          aValue = getDisplayName(a.toAddress).toLowerCase();
          bValue = getDisplayName(b.toAddress).toLowerCase();
          break;
        default:
          aValue = a.count;
          bValue = b.count;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    const totalChests = chestRewards.reduce((sum, reward) => sum + reward.count, 0);
    const playersWithChests = chestRewards.filter(r => r.count > 0).length;

    // Create a map of player addresses to their points
    const playerPointsMap = new Map<string, number>();
    if (cartridgePoints) {
      cartridgePoints.forEach(player => {
        playerPointsMap.set(player.player_id, player.total_points);
      });
    }
    
    // Calculate player counts for each bracket
    const bracketStats = new Map<number, number>();
    
    if (chestBrackets) {
      // Use actual brackets from the file
      chestBrackets.forEach(bracket => {
        const playersInBracket = chestRewards.filter(reward => reward.count === bracket.chests).length;
        bracketStats.set(bracket.chests, playersInBracket);
      });
    } else {
      // Fallback: calculate distribution from rewards if brackets not available
      chestRewards.forEach(reward => {
        const count = bracketStats.get(reward.count) || 0;
        bracketStats.set(reward.count, count + 1);
      });
    }

    const sortedBrackets = chestBrackets 
      ? chestBrackets.sort((a, b) => b.chests - a.chests) // Sort by chest count descending
      : Array.from(bracketStats.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([chests, count]) => ({ 
            min: 0, 
            max: 0, 
            chests, 
            playerCount: count 
          }));

    return (
      <div className="chest-prizes">
        <div className="chest-header">
          <div className="chest-title">
            <h3>Loot Chest Rewards</h3>
            <p className="chest-subtitle">
              NFT rewards distributed based on achievement points earned by {playersWithChests} players
            </p>
          </div>
          
          <div className="chest-summary">
            <div className="summary-card">
              <div className="summary-label">Total Chests</div>
              <div className="summary-value">{totalChests.toLocaleString()}</div>
              <div className="summary-usd">Eternum NFT Rewards</div>
            </div>
          </div>
        </div>

        {/* Distribution Explanation */}
        <div className="chest-distribution-explanation">
          <div className="distribution-grid">
            {sortedBrackets.map((bracket) => {
              const playerCount = bracketStats.get(bracket.chests) || 0;
              const percentage = chestRewards.length > 0 ? (playerCount / chestRewards.length) * 100 : 0;
              return (
                <div key={bracket.chests} className="distribution-item">
                  <div className="distribution-chest-count">{bracket.chests}</div>
                  <div className="distribution-details">
                    <div className="distribution-range">{bracket.min.toLocaleString()}-{bracket.max.toLocaleString()} pts</div>
                    <div className="distribution-players">{playerCount} players ({percentage.toFixed(0)}%)</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chest-controls">
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
              <option value="points">Sort by Chests</option>
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

        <div className="chest-table">
          <div className="table-header">
            <div className="header-player">Player</div>
            <div className="header-achievement">Reward Type</div>
            <div className="header-rewards">Chest Count</div>
          </div>
          
          <div className="table-body">
            {filteredRewards.map((reward, index) => {
              const playerPoints = playerPointsMap.get(reward.toAddress) || 0;
              
              return (
                <div key={`${reward.toAddress}-${index}`} className="player-row">
                  <div className="player-info">
                    {getPlayerName(reward.toAddress) ? (
                      <>
                        <div className="player-name">{getPlayerName(reward.toAddress)}</div>
                        <div className="player-address">{reward.toAddress}</div>
                      </>
                    ) : (
                      <div className="player-address-only">{reward.toAddress}</div>
                    )}
                    {playerPoints > 0 && (
                      <div className="player-points">{playerPoints.toLocaleString()} points earned</div>
                    )}
                  </div>
                  
                  <div className="achievement-info">
                    <div className="achievement-name">🗝️ Eternum Rewards Chest</div>
                    <div className="achievement-description">Season 1 NFT</div>
                  </div>
                  
                  <div className="reward-info">
                    <div className="reward-amount">{reward.count} {reward.count === 1 ? 'Chest' : 'Chests'}</div>
                    <div className="reward-usd">Achievement Rewards</div>
                  </div>
                </div>
              );
            })}
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
            <h3>Victory Prizes Distribution</h3>
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
      <div className="season-totals-banner">
        <div className="season-totals-content">
          <div className="season-totals-header">
            <div className="season-icon">🏆</div>
            <div className="season-title">
              <h2>Eternum Season 1 Total Rewards</h2>
              <p className="season-subtitle">Complete prize pool distribution across all reward categories</p>
            </div>
          </div>
          
          <div className="season-totals-grid">
            <div className="total-card lords-card">
              <div className="total-icon">
                <img src="/Lords.svg" alt="LORDS Token" className="lords-icon" />
              </div>
              <div className="total-info">
                <div className="total-amount">1,000,000</div>
                <div className="total-token">LORDS</div>
                <div className="total-usd">{formatLordsUSD(1000000)}</div>
              </div>
            </div>
            
            <div className="total-divider">
              <div className="divider-line"></div>
              <div className="divider-text">+</div>
              <div className="divider-line"></div>
            </div>
            
            <div className="total-card strk-card">
              <div className="total-icon">
                <img src="/strk.png" alt="STRK Token" className="strk-icon" />
              </div>
              <div className="total-info">
                <div className="total-amount">100,000</div>
                <div className="total-token">STRK</div>
                <div className="total-usd">{formatStrkUSD(100000)}</div>
              </div>
            </div>
          </div>
          
          <p className="strk-price-note">{STRK_PRICE_NOTE}</p>
          <div className="season-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-category">🏆 Victory Prizes</span>
              <span className="breakdown-description">Distributed based on tribe rankings and player contributions</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-category">🎮 Achievement Rewards</span>
              <span className="breakdown-description">300K LORDS for cartridge achievements, 25K STRK for Nexus-6 achievement</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="rewards-nav">
        <button
          className={`reward-type-btn ${selectedRewardType === 'victory' ? 'active' : ''}`}
          onClick={() => handleTabChange('victory')}
        >
          🏆 Victory Prizes
        </button>
        <button
          className={`reward-type-btn ${selectedRewardType === 'cartridge' ? 'active' : ''}`}
          onClick={() => handleTabChange('cartridge')}
        >
          🎮 Cartridge Achievements
        </button>
        <button
          className={`reward-type-btn ${selectedRewardType === 'daydreams' ? 'active' : ''}`}
          onClick={() => handleTabChange('daydreams')}
        >
          🤖 Daydreams Agents
        </button>
        <button
          className={`reward-type-btn ${selectedRewardType === 'chests' ? 'active' : ''}`}
          onClick={() => handleTabChange('chests')}
        >
          🗝️ Loot Chests
        </button>
      </div>
      
      <div className="rewards-content">
        {renderRewardTypeContent()}
      </div>
    </div>
  );
};

export default Rewards;
