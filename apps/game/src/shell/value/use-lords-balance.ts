import { WALLET_GAS_TOKEN } from "@realms-world/identity/wallet";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import { environmentLedger, lordsOf } from "./ledger";

export type WalletFunds = { token: string; balance: bigint; feeBalance: bigint };

const WALLET_FUNDS_QUERY_KEY = ["shell", "wallet-funds"] as const;
const READ_DEADLINE_MS = 15_000;

const withinDeadline = <T>(read: Promise<T>): Promise<T> =>
  Promise.race([
    read,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`no answer in ${READ_DEADLINE_MS} ms`)), READ_DEADLINE_MS),
    ),
  ]);

export const invalidateLordsBalance = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: WALLET_FUNDS_QUERY_KEY });

export const useWalletFunds = (owner: string | null) => {
  const ledger = environmentLedger();
  return useQuery({
    queryKey: [...WALLET_FUNDS_QUERY_KEY, owner],
    queryFn: async (): Promise<WalletFunds> => {
      try {
        return await withinDeadline(
          (async () => {
            const token = await ledger!.lordsToken();
            const balance = await ledger!.balanceOf(token, owner!);
            const paysFeeFromBalance = BigInt(token) === BigInt(WALLET_GAS_TOKEN);
            const feeBalance = paysFeeFromBalance ? balance : await ledger!.balanceOf(WALLET_GAS_TOKEN, owner!);
            return { token, balance, feeBalance };
          })(),
        );
      } catch (error) {
        console.error("lords_balance_read_failed", error);
        throw error;
      }
    },
    enabled: owner !== null && ledger !== null,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
};

export type LordsReading = number | "reading" | "failed";

export const useLordsBalance = (owner: string | null) => {
  const funds = useWalletFunds(owner);
  const lords = funds.data ? lordsOf(funds.data.balance) : null;
  const unreadable = funds.isError || environmentLedger() === null;
  const reading: LordsReading = lords ?? (unreadable ? "failed" : "reading");
  return { owner, lords, reading };
};
