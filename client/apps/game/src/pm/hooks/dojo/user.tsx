import { LordsAbi } from "@bibliothecadao/eternum";
import { useAccount, useCall } from "@starknet-react/core";
import { createContext, useCallback, useContext, useMemo } from "react";
import { Abi } from "starknet";
import { getPredictionMarketConfig } from "../../prediction-market-config";

type UserProviderProps = {
  children: React.ReactNode;
};

type UserProviderState =
  | {
      // LORDS balance from RPC
      lordsBalance: bigint;
      lordsBalanceLoading: boolean;
      refetchLordsBalance: () => void;
    }
  | undefined;

const UserProviderContext = createContext<UserProviderState>(undefined);

const normalizeUint256 = (value: unknown): bigint => {
  if (!value) return 0n;
  if (typeof value === "bigint") return value;

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const [low, high] = value;
      return BigInt(low ?? 0) + (BigInt(high ?? 0) << 128n);
    }
    if (value.length === 1) {
      return BigInt(value[0] ?? 0);
    }
  }

  if (typeof value === "object" && value !== null) {
    const maybeUint = value as { low?: bigint | number | string; high?: bigint | number | string };
    if (maybeUint.low !== undefined && maybeUint.high !== undefined) {
      return BigInt(maybeUint.low) + (BigInt(maybeUint.high) << 128n);
    }
  }

  try {
    return BigInt(value as string);
  } catch {
    return 0n;
  }
};

export function UserProvider({ children, ...props }: UserProviderProps) {
  const { account } = useAccount();
  const collateralToken = getPredictionMarketConfig().collateralToken;

  // LORDS balance from RPC
  const lordsBalanceCall = useCall({
    abi: LordsAbi as Abi,
    functionName: "balance_of",
    address: collateralToken as `0x${string}`,
    args: [(account?.address as `0x${string}`) ?? "0x0"],
    watch: true,
    refetchInterval: 5_000,
    enabled: Boolean(account?.address),
  });

  const lordsBalance = useMemo(() => normalizeUint256(lordsBalanceCall.data), [lordsBalanceCall.data]);

  const refetchLordsBalance = useCallback(() => {
    lordsBalanceCall.refetch?.();
  }, [lordsBalanceCall]);

  return (
    <UserProviderContext.Provider
      {...props}
      value={{
        lordsBalance,
        lordsBalanceLoading: lordsBalanceCall.isLoading,
        refetchLordsBalance,
      }}
    >
      {children}
    </UserProviderContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserProviderContext);

  if (context === undefined) throw new Error("useUser must be used within a UserProvider");

  return context;
};
