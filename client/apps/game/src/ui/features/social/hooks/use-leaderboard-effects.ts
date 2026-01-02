import { ENABLE_LEADERBOARD_EFFECTS_MOCKUP } from "@/ui/constants";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";

// Point categories matching the original implementation
export const POINT_CATEGORIES = {
  REGISTERED: 'registered',
  UNREGISTERED_SHAREHOLDER: 'unregistered_shareholder',
  TOTAL_SIGNIFICANT: 'total_significant',
} as const;

export type PointCategory = typeof POINT_CATEGORIES[keyof typeof POINT_CATEGORIES];

// Effect definitions
export interface PointDelta {
  playerId: string;
  category: PointCategory;
  delta: number;
  timestamp: number;
}

export interface RankChange {
  playerId: string;
  oldRank: number;
  newRank: number;
  timestamp: number;
}

export interface LeaderboardEffect {
  id: string;
  type: 'point_delta' | 'rank_change';
  playerId: string;
  timestamp: number;
  expiresAt: number;
  data: PointDelta | RankChange;
}

// Player data structure
export interface PlayerData {
  id: string;
  name: string;
  registeredPoints: number;
  totalPoints: number;
  unregisteredShareholderPoints: number;
  rank: number;
}

interface UseLeaderboardEffectsOptions {
  effectDuration?: number; // How long effects last in milliseconds
  mockupInterval?: number; // How often to generate mock effects in milliseconds
}

export function useLeaderboardEffects(
  players: PlayerData[],
  options: UseLeaderboardEffectsOptions = {}
) {
  const {
    effectDuration = 3000, // 3 seconds default
    mockupInterval = 2000, // 2 seconds default for mockup
  } = options;

  // Store previous player data for comparison
  const previousPlayersRef = useRef<PlayerData[]>([]);
  
  // Active effects state
  const [activeEffects, setActiveEffects] = useState<LeaderboardEffect[]>([]);
  
  // Effect ID counter
  const effectIdRef = useRef(0);

  // Generate a unique effect ID
  const generateEffectId = useCallback(() => {
    effectIdRef.current += 1;
    return `effect_${effectIdRef.current}`;
  }, []);

  // Clean up expired effects
  const cleanupExpiredEffects = useCallback(() => {
    const now = Date.now();
    setActiveEffects(prev => prev.filter(effect => effect.expiresAt > now));
  }, []);

  // Add a new effect
  const addEffect = useCallback((type: 'point_delta' | 'rank_change', playerId: string, data: PointDelta | RankChange) => {
    const now = Date.now();
    const effect: LeaderboardEffect = {
      id: generateEffectId(),
      type,
      playerId,
      timestamp: now,
      expiresAt: now + effectDuration,
      data,
    };
    
    setActiveEffects(prev => [...prev, effect]);
  }, [generateEffectId, effectDuration]);

  // Mock data generators
  const generateMockPointDelta = useCallback((player: PlayerData): PointDelta | null => {
    // Random chance to generate an effect (30% chance)
    if (Math.random() > 0.3) return null;

    const categories = [
      POINT_CATEGORIES.REGISTERED,
      POINT_CATEGORIES.UNREGISTERED_SHAREHOLDER,
      POINT_CATEGORIES.TOTAL_SIGNIFICANT,
    ];

    const category = categories[Math.floor(Math.random() * categories.length)];
    
    // Generate delta based on category
    let delta: number;
    switch (category) {
      case POINT_CATEGORIES.REGISTERED:
        delta = Math.floor(Math.random() * 200) + 10; // 10-210 points
        break;
      case POINT_CATEGORIES.UNREGISTERED_SHAREHOLDER:
        delta = Math.floor(Math.random() * 50) + 5; // 5-55 points
        break;
      case POINT_CATEGORIES.TOTAL_SIGNIFICANT:
        delta = Math.floor(Math.random() * 500) + 100; // 100-600 points
        break;
      default:
        delta = Math.floor(Math.random() * 100) + 10;
    }

    // Sometimes generate negative deltas (losses)
    if (Math.random() > 0.8) {
      delta = -delta;
    }

    return {
      playerId: player.id,
      category,
      delta,
      timestamp: Date.now(),
    };
  }, []);

  const generateMockRankChange = useCallback((player: PlayerData, players: PlayerData[]): RankChange | null => {
    // Random chance to generate a rank change (20% chance)
    if (Math.random() > 0.2) return null;

    const currentRank = player.rank;
    const maxRank = players.length;
    
    // Generate a new rank (prefer small changes)
    let rankDelta = Math.floor(Math.random() * 6) - 3; // -3 to +3
    if (rankDelta === 0) rankDelta = Math.random() > 0.5 ? 1 : -1;
    
    const newRank = Math.max(1, Math.min(maxRank, currentRank + rankDelta));
    
    if (newRank === currentRank) return null;

    return {
      playerId: player.id,
      oldRank: currentRank,
      newRank,
      timestamp: Date.now(),
    };
  }, []);

  // Detect real changes between current and previous player data
  const detectRealChanges = useCallback((current: PlayerData[], previous: PlayerData[]) => {
    if (previous.length === 0) return; // No previous data to compare

    const prevPlayerMap = new Map(previous.map(p => [p.id, p]));
    
    current.forEach(currentPlayer => {
      const prevPlayer = prevPlayerMap.get(currentPlayer.id);
      if (!prevPlayer) return;

      // Check for point changes
      const registeredDelta = currentPlayer.registeredPoints - prevPlayer.registeredPoints;
      const unregisteredDelta = currentPlayer.unregisteredShareholderPoints - prevPlayer.unregisteredShareholderPoints;
      const totalDelta = currentPlayer.totalPoints - prevPlayer.totalPoints;

      // Add point delta effects for significant changes
      if (registeredDelta !== 0) {
        addEffect('point_delta', currentPlayer.id, {
          playerId: currentPlayer.id,
          category: POINT_CATEGORIES.REGISTERED,
          delta: registeredDelta,
          timestamp: Date.now(),
        });
      }

      if (unregisteredDelta !== 0) {
        addEffect('point_delta', currentPlayer.id, {
          playerId: currentPlayer.id,
          category: POINT_CATEGORIES.UNREGISTERED_SHAREHOLDER,
          delta: unregisteredDelta,
          timestamp: Date.now(),
        });
      }

      if (Math.abs(totalDelta) > 100) { // Only show significant total changes
        addEffect('point_delta', currentPlayer.id, {
          playerId: currentPlayer.id,
          category: POINT_CATEGORIES.TOTAL_SIGNIFICANT,
          delta: totalDelta,
          timestamp: Date.now(),
        });
      }

      // Check for rank changes
      if (currentPlayer.rank !== prevPlayer.rank) {
        addEffect('rank_change', currentPlayer.id, {
          playerId: currentPlayer.id,
          oldRank: prevPlayer.rank,
          newRank: currentPlayer.rank,
          timestamp: Date.now(),
        });
      }
    });
  }, [addEffect]);

  // Generate mock effects on timer (mockup mode only)
  useEffect(() => {
    if (!ENABLE_LEADERBOARD_EFFECTS_MOCKUP || players.length === 0) return;

    const interval = setInterval(() => {
      // Generate mock effects for random players
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      const playersToEffect = shuffledPlayers.slice(0, Math.floor(Math.random() * 3) + 1); // 1-3 players

      playersToEffect.forEach(player => {
        // Generate point delta
        const pointDelta = generateMockPointDelta(player);
        if (pointDelta) {
          addEffect('point_delta', player.id, pointDelta);
        }

        // Generate rank change
        const rankChange = generateMockRankChange(player, players);
        if (rankChange) {
          addEffect('rank_change', player.id, rankChange);
        }
      });
    }, mockupInterval);

    return () => clearInterval(interval);
  }, [players, mockupInterval, generateMockPointDelta, generateMockRankChange, addEffect]);

  // Process player changes and detect effects
  useEffect(() => {
    if (ENABLE_LEADERBOARD_EFFECTS_MOCKUP) {
      // In mockup mode, we don't process real changes
      previousPlayersRef.current = players;
      return;
    }

    detectRealChanges(players, previousPlayersRef.current);
    previousPlayersRef.current = players;
  }, [players, detectRealChanges]);

  // Cleanup expired effects periodically
  useEffect(() => {
    const interval = setInterval(cleanupExpiredEffects, 500);
    return () => clearInterval(interval);
  }, [cleanupExpiredEffects]);

  // Get effects for a specific player
  const getEffectsForPlayer = useCallback((playerId: string) => {
    return activeEffects.filter(effect => effect.playerId === playerId);
  }, [activeEffects]);

  // Get point delta effects for a player
  const getPointDeltasForPlayer = useCallback((playerId: string) => {
    return activeEffects
      .filter(effect => effect.playerId === playerId && effect.type === 'point_delta')
      .map(effect => effect.data as PointDelta);
  }, [activeEffects]);

  // Get rank change effects for a player
  const getRankChangesForPlayer = useCallback((playerId: string) => {
    return activeEffects
      .filter(effect => effect.playerId === playerId && effect.type === 'rank_change')
      .map(effect => effect.data as RankChange);
  }, [activeEffects]);

  return {
    // State
    activeEffects,
    
    // Getters
    getEffectsForPlayer,
    getPointDeltasForPlayer,
    getRankChangesForPlayer,
    
    // Utils
    isMockupMode: ENABLE_LEADERBOARD_EFFECTS_MOCKUP,
  };
}