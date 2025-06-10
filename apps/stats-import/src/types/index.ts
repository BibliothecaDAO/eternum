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
} 