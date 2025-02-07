import { useCallback } from "react";
import { StarknetBridgeRealms as L1_REALMS_BRIDGE_ABI } from "@/abi/L1/StarknetBridgeRealms";
import { parseGwei } from "viem";
import { useWriteContract } from "wagmi";

import { REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";
import { SUPPORTED_L1_CHAIN_ID } from "@/utils/utils";

const FUNCTION = "depositTokens";

export function useWriteDepositRealms({
  onSuccess,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (data: any) => void;
}) {
  const { writeContractAsync, error, ...writeReturn } = useWriteContract({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutation: { onSuccess: (data: any) => onSuccess?.(data) },
  });

  const writeAsync = useCallback(
    async ({
      tokenIds,
      l2Address,
    }: {
      tokenIds: bigint[];
      l2Address: string;
    }) => {
      console.log(l2Address, tokenIds);

      if (!l2Address) throw new Error("Missing L2 Address");

      return await writeContractAsync({
        address: REALMS_BRIDGE_ADDRESS[SUPPORTED_L1_CHAIN_ID] as `0x${string}`,
        abi: L1_REALMS_BRIDGE_ABI,
        functionName: FUNCTION,
        args: [BigInt(Date.now()), BigInt(l2Address), tokenIds],
        value: parseGwei((40000 * tokenIds.length).toString()),
      });
    },
    [writeContractAsync]
  );
  return { writeAsync, error, ...writeReturn };
}
