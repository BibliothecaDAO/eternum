import {useMemo} from 'react';

// TODO: Replace with real Dojo event subscriptions once DojoProvider is upgraded.

export interface ActivityEvent {
  id: string;
  type: 'battle' | 'trade' | 'exploration' | 'guild';
  message: string;
  timestamp: number;
}

const MOCK_ACTIVITY: ActivityEvent[] = [
  {
    id: 'activity-1',
    type: 'battle',
    message: 'Army "Iron Vanguard" won battle at (42, 17)',
    timestamp: Date.now() / 1000 - 120,
  },
  {
    id: 'activity-2',
    type: 'trade',
    message: 'Sold 200 Wood for 150 Stone',
    timestamp: Date.now() / 1000 - 300,
  },
  {
    id: 'activity-3',
    type: 'exploration',
    message: 'Discovered new territory at (55, 23)',
    timestamp: Date.now() / 1000 - 600,
  },
  {
    id: 'activity-4',
    type: 'guild',
    message: 'Guild "Order of the Flame" declared war',
    timestamp: Date.now() / 1000 - 900,
  },
  {
    id: 'activity-5',
    type: 'battle',
    message: 'Realm Havenstone repelled a raid',
    timestamp: Date.now() / 1000 - 1800,
  },
];

interface UseActivityFeedResult {
  events: ActivityEvent[];
  totalCount: number;
}

export function useActivityFeed(): UseActivityFeedResult {
  const events = useMemo(
    () => [...MOCK_ACTIVITY].sort((a, b) => b.timestamp - a.timestamp),
    [],
  );
  return {events, totalCount: events.length};
}

export function formatRelativeTime(timestampSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, Math.floor(now - timestampSeconds));

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
