"use client";

import { useCallback } from "react";
import { StarknetBridgeRealms as L1_REALMS_BRIDGE_ABI } from "@/abi/L1/StarknetBridgeRealms";
import { SUPPORTED_L1_CHAIN_ID } from "@/constants/env";
import { hash, shortString, uint256 } from "starknet";
import { parseGwei } from "viem";
import { useWriteContract } from "wagmi";

import { REALMS_BRIDGE_ADDRESS } from "@realms-world/constants";

const FUNCTION = "withdrawTokens";

export function useWriteFinalizeWithdrawRealms() {
  const { writeContractAsync, data, ...writeReturn } = useWriteContract();

  // if (!l2Address) throw new Error("Missing L2 Address");

  const writeAsync = useCallback(
    async ({
      hash,
      l1Address,
      l2Address,
      tokenIds,
    }: {
      hash: string | bigint;
      l1Address: string;
      l2Address: string;
      tokenIds: string[] | bigint[];
    }) => {
      const parsedTokenIds = tokenIds.map((id) => {
        const uInt = uint256.bnToUint256(BigInt(id));
        return [BigInt(uInt.low), BigInt(uInt.high)];
      });
      const hashUint = uint256.bnToUint256(BigInt(hash));
      return await writeContractAsync({
        address: REALMS_BRIDGE_ADDRESS[SUPPORTED_L1_CHAIN_ID] as `0x${string}`,
        abi: L1_REALMS_BRIDGE_ABI,
        functionName: FUNCTION,
        args: [
          [
            BigInt(hashUint.low),
            BigInt(hashUint.high),
            BigInt(l1Address),
            BigInt(l2Address),
            BigInt(tokenIds.length),
            ...parsedTokenIds.flat(),
          ],
        ],
      });
    },
    [writeContractAsync],
  );
  return { writeAsync, data, ...writeReturn };
}
