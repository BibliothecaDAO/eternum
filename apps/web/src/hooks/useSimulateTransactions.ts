import type { QueryKey, UseQueryOptions as UseQueryOptions_, UseQueryResult } from "@tanstack/react-query";
import type { Call, Invocations, SimulateTransactionDetails, SimulateTransactionResponse } from "starknet";
import { useMemo } from "react";
import { useAccount, useInvalidateOnBlock, useProvider } from "@starknet-start/react";
import { useQuery } from "@tanstack/react-query";
import { TransactionType, WalletAccountV5 } from "starknet";

export interface SimulateTransactionsArgs {
  /** List of smart contract calls to simulate. */
  calls?: Call[];
  /** Simualte Transaction options. */
  options?: SimulateTransactionDetails;
}
type UseQueryProps<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Pick<
  UseQueryOptions_<TQueryFnData, TError, TData, TQueryKey>,
  "enabled" | "refetchInterval" | "retry" | "retryDelay"
>;
/** Options for `useSimulateTransactions`. */
export type UseSimulateTransactionsProps = SimulateTransactionsArgs &
  UseQueryProps<SimulateTransactionResponse, Error, SimulateTransactionResponse, ReturnType<typeof queryKey>> & {
    /** Refresh data at every block. */
    watch?: boolean;
  };

/** Value returned from `useSimulateTransactions`. */
export type UseSimulateTransactionsResult = UseQueryResult<SimulateTransactionResponse, Error>;

/**
 * Hook to estimate fees for smart contract calls.
 *
 * @remarks
 *
 * The hook only performs estimation if the `calls` is not undefined.
 */
export function useSimulateTransactions({
  calls,
  options,
  watch = false,
  enabled: enabled_ = true,
  ...props
}: UseSimulateTransactionsProps): UseSimulateTransactionsResult {
  const { address, connector } = useAccount();
  const { provider, paymasterProvider } = useProvider();

  const account = useMemo(() => {
    if (!address || !connector) return undefined;
    return new WalletAccountV5({
      address,
      provider,
      walletProvider: connector,
      paymaster: paymasterProvider,
    });
  }, [address, connector, provider, paymasterProvider]);

  const queryKey_ = useMemo(() => queryKey({ calls, options }), [calls, options]);

  const enabled = useMemo(() => Boolean(enabled_ && calls && account), [enabled_, calls, account]);

  useInvalidateOnBlock({
    enabled: Boolean(enabled && watch),
    queryKey: queryKey_,
  });

  return useQuery({
    queryKey: queryKey_,
    queryFn: queryFn({
      account,
      calls,
      options,
    }),
    enabled,
    ...props,
  });
}

function queryKey({ calls, options }: SimulateTransactionsArgs) {
  return [
    {
      entity: "simulateTransactions",
      calls,
      options,
    },
  ] as const;
}

function queryFn({ account, calls, options }: { account?: WalletAccountV5 } & SimulateTransactionsArgs) {
  return async () => {
    if (!account) throw new Error("account is required");
    if (!calls || calls.length === 0) throw new Error("calls are required");
    const invocations: Invocations = [
      {
        type: TransactionType.INVOKE as const,
        payload: calls,
      },
    ];
    return account.simulateTransaction(invocations, {
      ...options,
      skipValidate: true,
    });
  };
}
