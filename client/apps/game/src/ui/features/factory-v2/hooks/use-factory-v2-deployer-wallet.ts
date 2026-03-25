import { useEffect, useRef, useState } from "react";
import { RpcProvider } from "starknet";
import { getRpcUrlForChain } from "@/ui/features/admin/constants";
import {
  formatFactoryDeployerTokenBalance,
  resolveFactoryDeployerWallet,
  type FactoryDeployerTokenDefinition,
} from "../deployer-wallet";
import type { FactoryLaunchChain } from "../types";

interface FactoryDeployerTokenBalance {
  symbol: FactoryDeployerTokenDefinition["symbol"];
  displayBalance: string;
  isLoading: boolean;
  error: string | null;
}

type FactoryDeployerCopyState = "idle" | "copied" | "error";

const rpcProviderCache = new Map<FactoryLaunchChain, RpcProvider>();
const COPY_RESET_DELAY_MS = 2_000;

export const useFactoryV2DeployerWallet = (chain: FactoryLaunchChain) => {
  const wallet = resolveFactoryDeployerWallet(chain);
  const [balances, setBalances] = useState<FactoryDeployerTokenBalance[]>(() => buildLoadingBalances(wallet.tokens));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copyState, setCopyState] = useState<FactoryDeployerCopyState>("idle");
  const requestIdRef = useRef(0);
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void refreshBalances();
  }, [chain]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;

      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    },
    [],
  );

  async function refreshBalances() {
    const requestId = requestBalanceRefresh();
    setBalances(buildLoadingBalances(wallet.tokens));
    setCopyState("idle");

    const nextBalances = await readFactoryDeployerBalances(chain, wallet.address, wallet.tokens);

    if (requestIdRef.current !== requestId) {
      return;
    }

    setBalances(nextBalances);
    setIsRefreshing(false);
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopyState("copied");
      scheduleCopyStateReset();
    } catch {
      setCopyState("error");
      scheduleCopyStateReset();
    }
  }

  function requestBalanceRefresh() {
    requestIdRef.current += 1;
    setIsRefreshing(true);
    return requestIdRef.current;
  }

  function scheduleCopyStateReset() {
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
      copyResetTimerRef.current = null;
    }, COPY_RESET_DELAY_MS);
  }

  return {
    address: wallet.address,
    balances,
    copyAddress,
    copyState,
    isRefreshing,
    refreshBalances,
  };
};

async function readFactoryDeployerBalances(
  chain: FactoryLaunchChain,
  accountAddress: string,
  tokens: FactoryDeployerTokenDefinition[],
): Promise<FactoryDeployerTokenBalance[]> {
  const provider = getCachedFactoryRpcProvider(chain);

  return Promise.all(
    tokens.map(async (token) => {
      try {
        const balance = await readFactoryDeployerTokenBalance(provider, token.address, accountAddress);

        return {
          symbol: token.symbol,
          displayBalance: formatFactoryDeployerTokenBalance(balance, token.decimals),
          isLoading: false,
          error: null,
        };
      } catch {
        return {
          symbol: token.symbol,
          displayBalance: "Unavailable",
          isLoading: false,
          error: "Unable to load",
        };
      }
    }),
  );
}

async function readFactoryDeployerTokenBalance(
  provider: RpcProvider,
  tokenAddress: string,
  accountAddress: string,
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress: tokenAddress,
    entrypoint: "balance_of",
    calldata: [accountAddress],
  });

  const low = BigInt(result[0] ?? 0);
  const high = BigInt(result[1] ?? 0);
  return low + (high << 128n);
}

function getCachedFactoryRpcProvider(chain: FactoryLaunchChain) {
  const existingProvider = rpcProviderCache.get(chain);
  if (existingProvider) {
    return existingProvider;
  }

  const provider = new RpcProvider({ nodeUrl: getRpcUrlForChain(chain) });
  rpcProviderCache.set(chain, provider);
  return provider;
}

function buildLoadingBalances(tokens: FactoryDeployerTokenDefinition[]): FactoryDeployerTokenBalance[] {
  return tokens.map((token) => ({
    symbol: token.symbol,
    displayBalance: "...",
    isLoading: true,
    error: null,
  }));
}
