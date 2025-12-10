import { Token, TokenBalance } from "@dojoengine/torii-client";
import { useAccount } from "@starknet-react/core";
import { createContext, useCallback, useContext } from "react";
import { useTokens } from "./useTokens";

type UserProviderProps = {
  children: React.ReactNode;
};

type UserProviderState =
  | {
      tokens: {
        tokens: Token[];
        getBalance: Function;
        toDecimal: Function;
        balances: TokenBalance[];
        getTokens: (ca: string[]) => Token[];
        getBalances: (ca: string[]) => TokenBalance[];
        refetchBalances: Function;
      };
    }
  | undefined;

const UserProviderContext = createContext<UserProviderState>(undefined);

export function UserProvider({ children, ...props }: UserProviderProps) {
  const { account } = useAccount();

  const { tokens, getBalance, toDecimal, balances, refetchBalances } = useTokens({
    accountAddresses: account ? [account.address] : undefined,
    contractAddresses: [],
  });

  const getTokens = useCallback(
    (contractAddresses: string[]) => {
      return tokens.filter((i) => contractAddresses.map((i) => BigInt(i)).includes(BigInt(i.contract_address)));
    },
    [tokens, account],
  );

  const getBalances = useCallback(
    (contractAddresses: string[]) => {
      return balances
        .filter((i) => contractAddresses.map((i) => BigInt(i)).includes(BigInt(i.contract_address)))
        .filter((i) => BigInt(i.account_address) === BigInt(account?.address || 0));
    },
    [balances, account],
  );

  return (
    <UserProviderContext.Provider
      {...props}
      value={{
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

  if (context === undefined) throw new Error("useUser must be used within a TokensProvider");

  return context;
};
