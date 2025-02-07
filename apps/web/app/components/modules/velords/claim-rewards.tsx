import { RewardPool } from "@/abi/L2/RewardPool";
import { VeLords } from "@/abi/L2/VeLords";
import { useSimulateTransactions } from "@/hooks/useSimulateTransactions";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { StakingAddresses } from "@realms-world/constants";
import {
  Address,
  useAccount,
  useContract,
  useSendTransaction,
} from "@starknet-react/core";
import { useMemo, useState } from "react";
import { Call } from "starknet";

export const ClaimRewards = () => {
  const rewardPoolAddress = StakingAddresses.rewardpool[SUPPORTED_L2_CHAIN_ID];
  const { address } = useAccount();
  const [recipient, setRecipient] = useState<Address | undefined>(undefined);
  const { contract: rewardPool } = useContract({
    abi: RewardPool,
    address: rewardPoolAddress as Address,
  });

  const claimCall: Call[] | undefined = useMemo(() => {
    const finalRecipient = recipient ?? address;
    return finalRecipient != undefined && rewardPool
      ? [rewardPool.populate("claim", [finalRecipient])]
      : undefined;
  }, [address, rewardPool, recipient]);

  const { data: simulateData, error: simulateError } = useSimulateTransactions({
    calls: claimCall,
  });

  const lordsClaimable =
    simulateData?.[0]?.transaction_trace.execute_invocation.result[2];
  const {
    sendAsync: claimRewards,
    data: claimHash,
    isPending: claimIsSubmitting,
  } = useSendTransaction({
    calls:
      rewardPool && address
        ? [rewardPool?.populate("claim", [endRecipient])]
        : undefined,
  });

  return <div>ClaimRewards</div>;
};
