export interface RevenueData {
  category: string;
  description: string;
  amount: number;
  percentage: number;
  address: string;
  source: string;
  breakdown: string;
}

export interface PriceHeaderProps {
  lordsPrice: number;
  priceChange: number | null;
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
  totalLords: number;
}

export interface RevenueChartProps {
  revenueData: RevenueData[];
  lordsPrice: number;
  totalLords: number;
}

export interface FeeTableProps {
  revenueData: RevenueData[];
  lordsPrice: number;
}

export interface ColorScheme {
  background: string;
  border: string;
  hover: string;
}

export interface LordsApiResponse {
  lords: {
    usd: number;
    usd_24h_change: number;
    last_updated_at: number;
  };
  starknet: {
    usd: number;
    usd_24h_change: number;
    last_updated_at: number;
  };
}

// Rewards types
export interface PlayerRewards {
  lords: number;
  strk: number;
  ownerBonus: number;
  ownerBonusStrk: number;
  memberShare: number;
  memberShareStrk: number;
}

export interface Player {
  address: string;
  name: string;
  isOwner: boolean;
  points: number;
  pointsShare: number;
  realms: number;
  mines: number;
  hyperstructures: number;
  villages: number;
  banks: number;
  totalLordsReward: number;
  totalStrkReward: number;
  rewards: PlayerRewards;
}

export interface TribeOwner {
  address: string;
  name: string;
}

export interface TribePrize {
  lords: number;
  strk: number;
}

export interface Tribe {
  entityId: string;
  name: string;
  rank: number;
  isPublic: boolean;
  totalPoints: number;
  totalRealms: number;
  totalMines: number;
  totalHyperstructures: number;
  memberCount: number;
  prize: TribePrize;
  owner: TribeOwner;
  members: Player[];
}

export interface GameInfo {
  totalPlayers: number;
  totalTribes: number;
}

export interface EternumSocialData {
  timestamp: string;
  gameInfo: GameInfo;
  tribes: Tribe[];
}

export interface RewardsProps {
  lordsPrice: number;
  strkPrice: number;
}

// Achievement types
export interface AchievementPlayer {
  address: string;
  earnings: number;
  timestamp: number;
  completeds: string[];
}

export interface CartridgeReward {
  address: string;
  earnings: number;
  lordsReward: number;
  percentage: number;
}

export interface DaydreamsReward {
  address: string;
  strkReward: number;
}

// Known addresses mapping type
export interface KnownAddresses {
  [key: string]: string;
} 