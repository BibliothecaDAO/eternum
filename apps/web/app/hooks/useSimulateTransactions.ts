import { useMemo } from "react";
import type {
  Invocations} from "starknet";
import {
  
  
  
  
  TransactionType
} from "starknet";
import type {AccountInterface, Call, SimulateTransactionResponse, SimulateTransactionDetails} from "starknet";

import { useAccount, useInvalidateOnBlock } from "@starknet-react/core";
import type {
  QueryKey,
  UseQueryResult} from "@tanstack/react-query";
import {
  useQuery
  
} from "@tanstack/react-query";
import type {UseQueryOptions as UseQueryOptions_} from "@tanstack/react-query";

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
  UseQueryProps<
    SimulateTransactionResponse,
    Error,
    SimulateTransactionResponse,
    ReturnType<typeof queryKey>
  > & {
    /** Refresh data at every block. */
    watch?: boolean;
  };

/** Value returned from `useSimulateTransactions`. */
export type UseSimulateTransactionsResult = UseQueryResult<
  SimulateTransactionResponse,
  Error
>;

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
  const { account } = useAccount();

  const queryKey_ = useMemo(
    () => queryKey({ calls, options }),
    [calls, options]
  );

  const enabled = useMemo(() => Boolean(enabled_ && calls), [enabled_, calls]);

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

function queryFn({
  account,
  calls,
  options,
}: { account?: AccountInterface } & SimulateTransactionsArgs) {
  return async () => {
    if (!account) throw new Error("account is required");
    if (!calls || calls.length === 0) throw new Error("calls are required");
    const callMap = calls.map((call) => ({
      type: TransactionType.INVOKE,
      ...call,
    }));
    return account.simulateTransaction(callMap as Invocations, options);
  };
}
