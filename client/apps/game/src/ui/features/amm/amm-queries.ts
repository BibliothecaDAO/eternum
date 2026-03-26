import type { QueryClient } from "@tanstack/react-query";

const AMM_READ_REFRESH_INTERVAL_MS = 10_000;

export const AMM_READ_QUERY_OPTIONS = {
  retry: false as const,
  refetchOnWindowFocus: false as const,
  refetchInterval: AMM_READ_REFRESH_INTERVAL_MS,
};

export async function invalidateAmmReadQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["amm-pools"] }),
    queryClient.invalidateQueries({ queryKey: ["amm-pool-stats"] }),
    queryClient.invalidateQueries({ queryKey: ["amm-candles"] }),
    queryClient.invalidateQueries({ queryKey: ["amm-trade-history"] }),
    queryClient.invalidateQueries({ queryKey: ["amm-positions"] }),
  ]);
}
