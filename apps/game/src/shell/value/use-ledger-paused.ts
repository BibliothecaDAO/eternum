import { useQuery } from "@tanstack/react-query";

import type { EnvironmentLedger } from "./ledger";

/**
 * Whether the ledger's payouts are paused: it then pays no withdrawal and takes no claim until it resumes. Undefined
 * until it answers, or where there is no ledger to ask.
 */
export const useLedgerPaused = (ledger: EnvironmentLedger | null): boolean | undefined =>
  useQuery({
    queryKey: ["ledger", "paused"],
    queryFn: () => (ledger as EnvironmentLedger).paused(),
    enabled: ledger !== null,
    refetchInterval: 15_000,
  }).data;
