import { useCallback } from "react";
import { StarknetBridgeLords as L1_BRIDGE_ABI } from "@/abi/L1/StarknetBridgeLords";
import { SUPPORTED_L1_CHAIN_ID } from "@/constants/env";
import { parseEther } from "viem";
import { useWriteContract } from "wagmi";

import { LORDS_BRIDGE_ADDRESS } from "@realms-world/constants";

const FUNCTION = "deposit";

export function useWriteDepositLords({
  onSuccess,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (data: any) => Promise<void>;
}) {
  const { writeContractAsync, error, ...writeReturn } = useWriteContract({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutation: { onSuccess: (data: any) => onSuccess?.(data) },
  });

  // if (!l2Address) throw new Error("Missing L2 Address");

  const writeAsync = useCallback(
    async ({ amount, l2Address }: { amount: bigint; l2Address: string }) => {
      console.log(l2Address, amount);

      return await writeContractAsync({
        address: LORDS_BRIDGE_ADDRESS[SUPPORTED_L1_CHAIN_ID] as `0x${string}`,
        abi: L1_BRIDGE_ABI,
        functionName: FUNCTION,
        args: [amount, BigInt(l2Address), BigInt(1)],
        //@ts-expect-error should accept value
        value: parseEther("0.000000000001"),
      });
    },
    [writeContractAsync],
  );
  return { writeAsync, error, ...writeReturn };
}
