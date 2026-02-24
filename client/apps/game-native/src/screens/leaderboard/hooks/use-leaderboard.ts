import {useState, useMemo} from 'react';
import type {LeaderboardCategory, LeaderboardEntry} from '../types';

const MOCK_DATA: Record<LeaderboardCategory, LeaderboardEntry[]> = {
  points: [
    {id: '1', rank: 1, name: 'DragonLord', points: 45200},
    {id: '2', rank: 2, name: 'ShadowBlade', points: 38100},
    {id: '3', rank: 3, name: 'IronFist', points: 34500},
    {id: '4', rank: 4, name: 'StormBreaker', points: 28700},
    {id: '5', rank: 5, name: 'MoonWalker', points: 25300},
    {id: '6', rank: 6, name: 'FireStarter', points: 22100},
    {id: '7', rank: 7, name: 'NightHawk', points: 19800},
    {id: '8', rank: 8, name: 'SilverArrow', points: 17400},
    {id: '9', rank: 9, name: 'ThunderKing', points: 15200},
    {id: '10', rank: 10, name: 'FrostBite', points: 13600},
  ],
  military: [
    {id: '1', rank: 1, name: 'IronFist', points: 892},
    {id: '2', rank: 2, name: 'StormBreaker', points: 745},
    {id: '3', rank: 3, name: 'DragonLord', points: 678},
    {id: '4', rank: 4, name: 'NightHawk', points: 543},
    {id: '5', rank: 5, name: 'ThunderKing', points: 421},
  ],
  economic: [
    {id: '1', rank: 1, name: 'ShadowBlade', points: 1250000},
    {id: '2', rank: 2, name: 'MoonWalker', points: 980000},
    {id: '3', rank: 3, name: 'DragonLord', points: 875000},
    {id: '4', rank: 4, name: 'FireStarter', points: 720000},
    {id: '5', rank: 5, name: 'SilverArrow', points: 650000},
  ],
  guilds: [
    {id: '1', rank: 1, name: 'Order of the Flame', points: 125000, isGuild: true},
    {id: '2', rank: 2, name: 'Shadow Council', points: 98000, isGuild: true},
    {id: '3', rank: 3, name: 'Iron Legion', points: 87000, isGuild: true},
    {id: '4', rank: 4, name: 'Arcane Collective', points: 65000, isGuild: true},
    {id: '5', rank: 5, name: 'Wandering Wolves', points: 42000, isGuild: true},
  ],
};

export function useLeaderboard() {
  const [category, setCategory] = useState<LeaderboardCategory>('points');
  const [isLoading] = useState(false);

  // TODO: Replace with real data from Torii
  const entries = useMemo(() => MOCK_DATA[category], [category]);
  const topThree = useMemo(() => entries.slice(0, 3), [entries]);
  const rest = useMemo(() => entries.slice(3), [entries]);

  return {category, setCategory, entries, topThree, rest, isLoading};
}
