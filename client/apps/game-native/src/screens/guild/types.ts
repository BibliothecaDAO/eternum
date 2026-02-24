export interface GuildMember {
  id: string;
  username: string;
  role: 'leader' | 'officer' | 'member';
  isOnline: boolean;
  points: number;
}

export interface Guild {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  maxMembers: number;
  rank: number;
  totalPoints: number;
  members: GuildMember[];
}
