export type LeaderboardCategory = 'points' | 'military' | 'economic' | 'guilds';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  points: number;
  isGuild?: boolean;
}
