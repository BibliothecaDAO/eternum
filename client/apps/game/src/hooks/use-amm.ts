import { AmmClient } from "@bibliothecadao/amm-sdk";
import { useMemo, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import type { Call } from "starknet";

const PLACEHOLDER_AMM_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000001";
const PLACEHOLDER_LORDS_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000002";
const PLACEHOLDER_INDEXER_URL = "https://amm-indexer.eternum.io";

export function useAmm() {
  const { account } = useAccount();

  const client = useMemo(
    () =>
      new AmmClient({
        ammAddress: PLACEHOLDER_AMM_ADDRESS,
        lordsAddress: PLACEHOLDER_LORDS_ADDRESS,
        indexerUrl: PLACEHOLDER_INDEXER_URL,
      }),
    [],
  );

  const executeSwap = useCallback(
    async (calls: Call | Call[]) => {
      if (!account) {
        throw new Error("Wallet not connected");
      }
      const callArray = Array.isArray(calls) ? calls : [calls];
      const result = await account.execute(callArray);
      return result.transaction_hash;
    },
    [account, client],
  );

  return { client, executeSwap, account };
}
