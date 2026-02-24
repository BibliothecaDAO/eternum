import {useMemo} from 'react';

// TODO: Replace with real Dojo queries once DojoProvider is upgraded.

export interface UrgentAction {
  id: string;
  type: 'capacity' | 'attack' | 'expiring' | 'stamina';
  message: string;
  realmEntityId: number;
  severity: 'high' | 'medium';
}

const MOCK_URGENT_ACTIONS: UrgentAction[] = [
  {
    id: 'urgent-1',
    type: 'capacity',
    message: 'Realm Havenstone storage at 95% capacity',
    realmEntityId: 101,
    severity: 'high',
  },
  {
    id: 'urgent-2',
    type: 'attack',
    message: 'Army "Iron Vanguard" under attack near (42, 17)',
    realmEntityId: 102,
    severity: 'high',
  },
  {
    id: 'urgent-3',
    type: 'expiring',
    message: 'Trade offer for 500 Wood expires in 2 min',
    realmEntityId: 101,
    severity: 'medium',
  },
  {
    id: 'urgent-4',
    type: 'stamina',
    message: 'Army "Dune Riders" has full stamina (idle)',
    realmEntityId: 103,
    severity: 'medium',
  },
];

interface UseUrgentActionsResult {
  actions: UrgentAction[];
  highCount: number;
  mediumCount: number;
}

export function useUrgentActions(): UseUrgentActionsResult {
  const actions = MOCK_URGENT_ACTIONS;
  const highCount = useMemo(() => actions.filter(a => a.severity === 'high').length, [actions]);
  const mediumCount = useMemo(() => actions.filter(a => a.severity === 'medium').length, [actions]);
  return {actions, highCount, mediumCount};
}
