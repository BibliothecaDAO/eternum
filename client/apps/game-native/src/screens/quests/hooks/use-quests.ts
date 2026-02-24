import {useState, useMemo} from 'react';
import type {Quest, QuestCategory} from '../types';

const MOCK_QUESTS: Quest[] = [
  {
    id: '1',
    title: 'First Steps',
    description: 'Build your first farm and produce wheat',
    category: 'economic',
    status: 'active',
    progress: 0.5,
    steps: [
      {id: '1a', label: 'Build a Farm', completed: true},
      {id: '1b', label: 'Produce 100 Wheat', completed: false},
    ],
    reward: {type: 'Lords', amount: 500},
  },
  {
    id: '2',
    title: 'Defender of the Realm',
    description: 'Train your first army and win a battle',
    category: 'military',
    status: 'active',
    progress: 0.33,
    steps: [
      {id: '2a', label: 'Build Barracks', completed: true},
      {id: '2b', label: 'Train 10 Knights', completed: false},
      {id: '2c', label: 'Win a battle', completed: false},
    ],
    reward: {type: 'Lords', amount: 1000},
  },
  {
    id: '3',
    title: 'Trade Master',
    description: 'Complete 5 successful trades',
    category: 'economic',
    status: 'available',
    progress: 0,
    steps: [
      {id: '3a', label: 'Complete 1 trade', completed: false},
      {id: '3b', label: 'Complete 3 trades', completed: false},
      {id: '3c', label: 'Complete 5 trades', completed: false},
    ],
    reward: {type: 'Lords', amount: 2000},
  },
  {
    id: '4',
    title: 'Explorer',
    description: 'Discover 10 hexes on the world map',
    category: 'exploration',
    status: 'available',
    progress: 0,
    steps: [
      {id: '4a', label: 'Discover 3 hexes', completed: false},
      {id: '4b', label: 'Discover 7 hexes', completed: false},
      {id: '4c', label: 'Discover 10 hexes', completed: false},
    ],
    reward: {type: 'Lords', amount: 750},
  },
  {
    id: '5',
    title: 'Guild Founder',
    description: 'Join or create a guild',
    category: 'social',
    status: 'completed',
    progress: 1,
    steps: [{id: '5a', label: 'Join a guild', completed: true}],
    reward: {type: 'Lords', amount: 300},
  },
];

export function useQuests() {
  const [filter, setFilter] = useState<QuestCategory>('all');
  const [isLoading] = useState(false);

  // TODO: Replace with real data from Torii
  const quests = MOCK_QUESTS;

  const filteredQuests = useMemo(() => {
    if (filter === 'all') return quests;
    return quests.filter(q => q.status === filter);
  }, [quests, filter]);

  const activeCount = quests.filter(q => q.status === 'active').length;
  const availableCount = quests.filter(q => q.status === 'available').length;

  return {quests: filteredQuests, filter, setFilter, isLoading, activeCount, availableCount};
}
