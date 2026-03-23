import { AmmClient } from "@bibliothecadao/amm-sdk";
import { useMemo, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import type { Call } from "starknet";
import { env } from "../../env";

interface AmmRuntimeConfig {
  ammAddress: string;
  indexerUrl: string;
  isConfigured: boolean;
  lordsAddress: string;
}

function resolveAmmRuntimeConfig(): AmmRuntimeConfig {
  const ammAddress = env.VITE_PUBLIC_AMM_ADDRESS;
  const lordsAddress = env.VITE_PUBLIC_AMM_LORDS_ADDRESS;
  const indexerUrl = env.VITE_PUBLIC_AMM_INDEXER_URL;

  return {
    ammAddress,
    lordsAddress,
    indexerUrl,
    isConfigured: ammAddress.length > 0 && lordsAddress.length > 0 && indexerUrl.length > 0,
  };
}

export function useAmm() {
  const { account } = useAccount();
  const runtimeConfig = useMemo(() => resolveAmmRuntimeConfig(), []);

  const client = useMemo(
    () =>
      runtimeConfig.isConfigured
        ? new AmmClient({
            ammAddress: runtimeConfig.ammAddress,
            lordsAddress: runtimeConfig.lordsAddress,
            indexerUrl: runtimeConfig.indexerUrl,
          })
        : null,
    [runtimeConfig],
  );

  const executeSwap = useCallback(
    async (calls: Call | Call[]) => {
      if (!client) {
        throw new Error("AMM is not configured");
      }
      if (!account) {
        throw new Error("Wallet not connected");
      }
      const callArray = Array.isArray(calls) ? calls : [calls];
      const result = await account.execute(callArray);
      return result.transaction_hash;
    },
    [account, client],
  );

  return { client, executeSwap, account, config: runtimeConfig, isConfigured: runtimeConfig.isConfigured };
}
