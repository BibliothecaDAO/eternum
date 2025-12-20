import { LordsAbi } from "@bibliothecadao/eternum";
import type { Token, TokenBalance } from "@dojoengine/torii-client";
import { useAccount, useCall } from "@starknet-react/core";
import { createContext, useCallback, useContext, useMemo } from "react";
import { Abi } from "starknet";
import { getPredictionMarketConfig } from "../../prediction-market-config";
import { useTokens } from "./use-tokens";

type UserProviderProps = {
  children: React.ReactNode;
};

type UserProviderState =
  | {
      // LORDS balance from RPC
      lordsBalance: bigint;
      lordsBalanceLoading: boolean;
      refetchLordsBalance: () => void;
      // Token balances from Torii (for VaultPositions, VaultFees, etc.)
      tokens: {
        tokens: Token[];
        getBalance: (token: Token) => TokenBalance | undefined;
        toDecimal: (token: Token, balance: TokenBalance | undefined) => number;
        balances: TokenBalance[];
        getTokens: (ca: string[]) => Token[];
        getBalances: (ca: string[]) => TokenBalance[];
        refetchBalances: () => Promise<void>;
      };
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

  // Token balances from Torii (for VaultPositions, VaultFees, etc.)
  const { tokens, getBalance, toDecimal, balances, refetchBalances } = useTokens({
    accountAddresses: account ? [account.address] : undefined,
    contractAddresses: [],
  });

  const getTokens = useCallback(
    (contractAddresses: string[]) => {
      return tokens.filter((i) => contractAddresses.map((addr) => BigInt(addr)).includes(BigInt(i.contract_address)));
    },
    [tokens],
  );

  const getBalances = useCallback(
    (contractAddresses: string[]) => {
      return balances
        .filter((i) => contractAddresses.map((addr) => BigInt(addr)).includes(BigInt(i.contract_address)))
        .filter((i) => BigInt(i.account_address) === BigInt(account?.address || 0));
    },
    [balances, account?.address],
  );

  return (
    <UserProviderContext.Provider
      {...props}
      value={{
        lordsBalance,
        lordsBalanceLoading: lordsBalanceCall.isLoading,
        refetchLordsBalance,
        tokens: {
          tokens,
          getBalance,
          toDecimal,
          balances,
          getTokens,
          getBalances,
          refetchBalances,
        },
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
