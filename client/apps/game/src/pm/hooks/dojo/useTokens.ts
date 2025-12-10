import { GetTokenBalanceRequest, GetTokenRequest, SubscriptionCallbackArgs } from "@dojoengine/sdk";
import type { Subscription, Token, TokenBalance } from "@dojoengine/torii-wasm";
import { useCallback, useEffect, useRef, useState } from "react";
import { deepEqual } from "../../utils";
import { useDojoSdk } from "./useDojoSdk";

export function useTokens(request: GetTokenRequest & GetTokenBalanceRequest, accountRequired = true) {
  const { sdk } = useDojoSdk();
  const [tokens, setTokens] = useState<Token[]>([]);
  const requestRef = useRef<(GetTokenRequest & GetTokenBalanceRequest) | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const subscriptionRef = useRef<Subscription | null>(null);

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
      }
    };
  }, []);

  const fetchTokens = useCallback(async () => {
    const tokens = await sdk.getTokens({
      contractAddresses: request.contractAddresses ?? [],
      tokenIds: request.tokenIds,
    });
    setTokens(tokens.items);
  }, [sdk]);

  const fetchTokenBalances = useCallback(async () => {
    if (!requestRef.current) return;
    const [tokenBalances, subscription] = await sdk.subscribeTokenBalance({
      contractAddresses: requestRef.current.contractAddresses ?? [],
      accountAddresses: requestRef.current.accountAddresses,
      tokenIds: request.tokenIds ?? [],
      callback: ({ data, error }: SubscriptionCallbackArgs<TokenBalance>) => {
        if (error) {
          console.error(error);
          return;
        }
        setTokenBalances((prev) => updateTokenBalancesList(prev, data));
      },
    });

    if (subscriptionRef.current) {
      subscriptionRef.current.cancel();
    }

    subscriptionRef.current = subscription;
    setTokenBalances(tokenBalances.items);
  }, [sdk]);

  useEffect(() => {
    if (!deepEqual(request, requestRef.current)) {
      requestRef.current = request;
      fetchTokens();

      if (accountRequired && (!request.accountAddresses || request.accountAddresses.length === 0)) {
      } else {
        fetchTokenBalances();
      }
    }
  }, [request]);

  function getBalance(token: Token): TokenBalance | undefined {
    return tokenBalances.find(
      (balance) =>
        BigInt(balance.contract_address) === BigInt(token.contract_address) &&
        BigInt(balance.token_id || 0) === BigInt(token.token_id || 0),
    );
  }

  function toDecimal(token: Token, balance: TokenBalance | undefined): number {
    return Number.parseInt(balance?.balance ?? "0", 16) * 10 ** -token.decimals;
  }

  const refetchBalances = useCallback(async () => {
    fetchTokens();
    fetchTokenBalances();
  }, []);

  return {
    tokens,
    balances: tokenBalances,
    getBalance,
    toDecimal,
    refetchBalances,
  };
}

function updateTokenBalancesList(previousBalances: TokenBalance[], newBalance: TokenBalance): TokenBalance[] {
  if (BigInt(newBalance.account_address) === 0n && BigInt(newBalance.contract_address) === 0n) {
    return previousBalances;
  }
  const existingBalanceIndex = previousBalances.findIndex(
    (balance) =>
      BigInt(balance.token_id || 0) === BigInt(newBalance.token_id || 0) &&
      BigInt(balance.contract_address) === BigInt(newBalance.contract_address) &&
      BigInt(balance.account_address) === BigInt(newBalance.account_address),
  );

  // If balance doesn't exist, append it to the list
  if (existingBalanceIndex === -1) {
    return [...previousBalances, newBalance];
  }

  // If balance exists, update it while preserving order
  return previousBalances.map((balance, index) => (index === existingBalanceIndex ? newBalance : balance));
}

//
