import { useRef, useEffect, useState, useCallback } from "react";
import { ContractAddress } from "@bibliothecadao/types";

export interface PlayerEffectData {
  address: ContractAddress;
  name: string;
  totalPoints: number;
  registeredPoints: number;
  unregisteredShareholderPoints: number;
  realTimeRank: number;
}

export interface PointDelta {
  address: ContractAddress;
  delta: number;
  type: 'registered' | 'unregistered' | 'total';
  color: string;
  timestamp: number;
}

export interface RankChange {
  address: ContractAddress;
  oldRank: number;
  newRank: number;
  direction: 'up' | 'down' | 'none';
  timestamp: number;
}

interface LeaderboardEffectsState {
  pointDeltas: PointDelta[];
  rankChanges: RankChange[];
}

const EFFECT_DURATION = 3000; // 3 seconds
const COLORS = {
  registered: '#fbbf24', // amber-400
  unregistered: '#10b981', // emerald-500  
  total: '#f59e0b', // amber-500
} as const;

export const useLeaderboardEffects = (
  players: PlayerEffectData[],
  updateInterval: number = 60000
) => {
  const previousPlayersRef = useRef<Map<ContractAddress, PlayerEffectData>>(new Map());
  const [effects, setEffects] = useState<LeaderboardEffectsState>({
    pointDeltas: [],
    rankChanges: [],
  });

  // Clean up expired effects
  const cleanupExpiredEffects = useCallback(() => {
    const now = Date.now();
    setEffects(prev => ({
      pointDeltas: prev.pointDeltas.filter(delta => now - delta.timestamp < EFFECT_DURATION),
      rankChanges: prev.rankChanges.filter(change => now - change.timestamp < EFFECT_DURATION),
    }));
  }, []);

  // Effect cleanup interval
  useEffect(() => {
    const interval = setInterval(cleanupExpiredEffects, 500);
    return () => clearInterval(interval);
  }, [cleanupExpiredEffects]);

  // Detect changes when players data updates
  useEffect(() => {
    if (players.length === 0) return;

    const now = Date.now();
    const currentPlayersMap = new Map<ContractAddress, PlayerEffectData>();
    
    // Build current players map
    players.forEach(player => {
      currentPlayersMap.set(player.address, player);
    });

    const newPointDeltas: PointDelta[] = [];
    const newRankChanges: RankChange[] = [];

    // Compare with previous state
    for (const [address, currentPlayer] of currentPlayersMap) {
      const previousPlayer = previousPlayersRef.current.get(address);
      
      if (previousPlayer) {
        // Check for point changes
        const registeredDelta = currentPlayer.registeredPoints - previousPlayer.registeredPoints;
        const unregisteredDelta = currentPlayer.unregisteredShareholderPoints - previousPlayer.unregisteredShareholderPoints;
        const totalDelta = currentPlayer.totalPoints - previousPlayer.totalPoints;

        // Add point delta effects for gains only
        if (registeredDelta > 0) {
          newPointDeltas.push({
            address,
            delta: registeredDelta,
            type: 'registered',
            color: COLORS.registered,
            timestamp: now,
          });
        }

        if (unregisteredDelta > 0) {
          newPointDeltas.push({
            address,
            delta: unregisteredDelta,
            type: 'unregistered',
            color: COLORS.unregistered,
            timestamp: now,
          });
        }

        // Add total delta for significant changes
        if (totalDelta > 100) {
          newPointDeltas.push({
            address,
            delta: totalDelta,
            type: 'total',
            color: COLORS.total,
            timestamp: now,
          });
        }

        // Check for rank changes
        if (currentPlayer.realTimeRank !== previousPlayer.realTimeRank) {
          const direction = currentPlayer.realTimeRank < previousPlayer.realTimeRank ? 'up' : 'down';
          
          newRankChanges.push({
            address,
            oldRank: previousPlayer.realTimeRank,
            newRank: currentPlayer.realTimeRank,
            direction,
            timestamp: now,
          });
        }
      }
    }

    // Update effects state
    if (newPointDeltas.length > 0 || newRankChanges.length > 0) {
      setEffects(prev => ({
        pointDeltas: [...prev.pointDeltas, ...newPointDeltas],
        rankChanges: [...prev.rankChanges, ...newRankChanges],
      }));
    }

    // Store current state for next comparison
    previousPlayersRef.current = currentPlayersMap;
  }, [players]);

  // Get effects for a specific player
  const getPlayerEffects = useCallback((address: ContractAddress) => {
    return {
      pointDeltas: effects.pointDeltas.filter(delta => delta.address === address),
      rankChanges: effects.rankChanges.filter(change => change.address === address),
    };
  }, [effects]);

  return {
    effects,
    getPlayerEffects,
    hasEffects: effects.pointDeltas.length > 0 || effects.rankChanges.length > 0,
  };
};