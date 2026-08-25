import { queryOptions } from "@tanstack/react-query";
import { getLordsInfo } from "@/lib/getLordsPrice";
import { getTreasuryBalance } from "@/lib/getTreasuryBalance";

export const lordsInfoQueryOptions = () =>
  queryOptions({
    queryKey: ["lordsInfo"],
    queryFn: getLordsInfo,
    staleTime: 60_000,
  });

export const treasuryBalanceQueryOptions = () =>
  queryOptions({
    queryKey: ["treasuryBalance"],
    queryFn: getTreasuryBalance,
    staleTime: 60_000,
  });
