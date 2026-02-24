export type QuestCategory = 'all' | 'active' | 'available' | 'completed';

export interface QuestStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  category: 'economic' | 'military' | 'exploration' | 'social';
  status: 'active' | 'available' | 'completed';
  progress: number; // 0 to 1
  steps: QuestStep[];
  reward: {
    type: string;
    amount: number;
  };
}
