import type { Address } from "@starknet-react/core";
import type { Call } from "starknet";
import { useMemo, useState } from "react";
import { RewardPool } from "@/abi/L2/RewardPool";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import {
  useAccount,
  useContract,
  useSendTransaction,
} from "@starknet-react/core";

import { StakingAddresses } from "@realms-world/constants";

import { useSimulateTransactions } from "./useSimulateTransactions";

export default function useVeLordsClaims() {
  const { address } = useAccount();

  // Determine the reward pool address via chain configuration.
  const rewardPoolAddress = StakingAddresses.rewardpool[SUPPORTED_L2_CHAIN_ID];

  // Allow room to override the recipient (defaults to current account address).
  const [recipient, setRecipient] = useState<Address | undefined>(undefined);

  // Initialize the reward pool contract.
  const { contract: rewardPool } = useContract({
    abi: RewardPool,
    address: rewardPoolAddress as Address,
  });

  // Create the call to claim rewards. If no recipient is provided, use the current account.
  const claimCall: Call[] | undefined = useMemo(() => {
    const finalRecipient = recipient ?? address;
    return finalRecipient !== undefined && rewardPool
      ? [rewardPool.populate("claim", [finalRecipient])]
      : undefined;
  }, [address, recipient, rewardPool]);

  // Simulate the claim rewards call to get the potential rewards amount.
  const { data: simulateData } = useSimulateTransactions({
    calls: claimCall,
  });

  // Retrieve the claimable amount (ensure this aligns with your contract’s response shape).
  const lordsClaimable = useMemo(
    () =>
      BigInt(
        simulateData?.[0]?.transaction_trace?.execute_invocation?.result[2] ??
          0,
      ),
    [simulateData],
  );

  // Prepare the function to send the claim rewards transaction.
  const { sendAsync: claimRewards, isPending: claimIsSubmitting } =
    useSendTransaction({
      calls: claimCall,
    });

  return {
    recipient,
    setRecipient,
    claimCall,
    lordsClaimable,
    claimRewards,
    claimIsSubmitting,
  };
}
