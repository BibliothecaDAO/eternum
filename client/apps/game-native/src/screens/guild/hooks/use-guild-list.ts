import {useState, useMemo} from 'react';
import type {Guild} from '../types';

const MOCK_GUILDS: Guild[] = [
  {
    id: '1',
    name: 'Order of the Flame',
    description: 'Warriors united by fire and honor',
    memberCount: 24,
    maxMembers: 30,
    rank: 1,
    totalPoints: 125000,
    members: [],
  },
  {
    id: '2',
    name: 'Shadow Council',
    description: 'Masters of trade and diplomacy',
    memberCount: 18,
    maxMembers: 25,
    rank: 2,
    totalPoints: 98000,
    members: [],
  },
  {
    id: '3',
    name: 'Iron Legion',
    description: 'Strength through unity',
    memberCount: 30,
    maxMembers: 30,
    rank: 3,
    totalPoints: 87000,
    members: [],
  },
  {
    id: '4',
    name: 'Arcane Collective',
    description: 'Knowledge is power',
    memberCount: 12,
    maxMembers: 20,
    rank: 4,
    totalPoints: 65000,
    members: [],
  },
  {
    id: '5',
    name: 'Wandering Wolves',
    description: 'Lone wolves that hunt in packs',
    memberCount: 8,
    maxMembers: 15,
    rank: 5,
    totalPoints: 42000,
    members: [],
  },
];

export function useGuildList() {
  const [isLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // TODO: Replace with real data from Torii
  const guilds = MOCK_GUILDS;

  const filteredGuilds = useMemo(() => {
    if (!searchText.trim()) return guilds;
    return guilds.filter(g =>
      g.name.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [guilds, searchText]);

  return {guilds: filteredGuilds, isLoading, searchText, setSearchText};
}
