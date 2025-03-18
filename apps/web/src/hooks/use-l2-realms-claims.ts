import type { BlockNumber, Call } from "starknet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RealmsABI } from "@/abi/L2/Realms";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import {
  useAccount,
  useContract,
  useReadContract,
  useSendTransaction,
} from "@starknet-react/core";
import { BlockTag } from "starknet";
import { formatEther } from "viem";

import { CollectionAddresses } from "@realms-world/constants";

import { useToast } from "./use-toast";

export const useL2RealmsClaims = () => {
  const { toast } = useToast();
  const { address: l2Address } = useAccount();
  const l2RealmsAddress = CollectionAddresses.realms[
    SUPPORTED_L2_CHAIN_ID
  ] as `0x${string}`;

  const [previousBalance, setPreviousBalance] = useState<bigint | null>(null);
  const [easedBalance, setEasedBalance] = useState<bigint | null>(null);

  const { data: balance, isFetching } = useReadContract({
    address: l2RealmsAddress,
    abi: RealmsABI,
    functionName: "get_reward_balance_for",
    enabled: !!l2Address,
    watch: true,
    args: l2Address ? [l2Address] : undefined,
    blockIdentifier: BlockTag.PENDING as BlockNumber,
  });

  useEffect(() => {
    if (balance !== undefined && balance !== previousBalance) {
      const start = previousBalance ?? BigInt(Number(balance));
      const end = BigInt(Number(balance));
      const duration = 1000; // duration of the easing in ms
      const startTime = Date.now();

      const ease = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedValue =
          start + BigInt(Math.round(Number(end - start) * progress));

        setEasedBalance(easedValue);

        if (progress < 1) {
          requestAnimationFrame(ease);
        } else {
          setPreviousBalance(BigInt(Number(balance)));
        }
      };

      ease();
    }
  }, [balance, previousBalance, isFetching]);

  const { contract } = useContract({
    abi: RealmsABI,
    address: l2RealmsAddress,
  });

  const calls: Call[] = useMemo(() => {
    if (!l2Address || !contract) return [];
    return [contract.populate("reward_claim", [])];
  }, [l2Address, contract]);

  const {
    sendAsync,
    data: claimHash,
    isPending: isSubmitting,
  } = useSendTransaction({ calls });

  const claimRewards = useCallback(async () => {
    const tx = await sendAsync();
    if (tx.transaction_hash) {
      toast({
        title: "Realms' Lords Claim Submitted",
        description: `Claim of ${formatEther(balance as bigint)} Lords in progress`,
      });
    }
    return tx;
  }, [sendAsync, toast, balance]);

  return {
    balance: easedBalance,
    calls,
    isFetching,
    isSubmitting,
    claimRewards,
    claimHash,
  };
};
