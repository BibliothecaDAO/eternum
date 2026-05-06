import { useQuery } from "@tanstack/react-query";
import type { ActiveTransferData } from "@bibliothecadao/torii";

import { POLLING_INTERVALS } from "@/config/polling";
import { sqlApi } from "@/services/api";

const DEFAULT_ACTIVE_TRANSFERS_LIMIT = 500;
const DEFAULT_ACTIVE_TRANSFERS_LOOKBACK_SECONDS = 1_800;

export const useActiveTransfers = (
  limit: number = DEFAULT_ACTIVE_TRANSFERS_LIMIT,
  lookbackSeconds: number = DEFAULT_ACTIVE_TRANSFERS_LOOKBACK_SECONDS,
) =>
  useQuery<ActiveTransferData[]>({
    queryKey: ["activeTransfers", limit, lookbackSeconds],
    queryFn: async () => sqlApi.fetchActiveTransfers(limit, lookbackSeconds),
    staleTime: POLLING_INTERVALS.storyEventsStaleMs,
    refetchInterval: POLLING_INTERVALS.storyEventsMs,
  });
