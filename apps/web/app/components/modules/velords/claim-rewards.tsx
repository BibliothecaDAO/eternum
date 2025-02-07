import { RewardPool } from "@/abi/L2/RewardPool";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
//import { VeLords } from "@/abi/L2/VeLords";
import { useSimulateTransactions } from "@/hooks/useSimulateTransactions";
import { formatNumber, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { StakingAddresses } from "@realms-world/constants";
import type {
  Address} from "@starknet-react/core";
import {
  useAccount,
  useContract,
  useSendTransaction,
} from "@starknet-react/core";
import { useMemo, useState } from "react";
import type { Call } from "starknet";
import { formatEther } from "viem";

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
    return (finalRecipient != undefined && rewardPool)
      ? [rewardPool.populate("claim", [finalRecipient])]
      : undefined;
  }, [address, rewardPool, recipient]);

  const { data: simulateData/*, error: simulateError */ } = useSimulateTransactions({
    calls: claimCall,
  });

  const lordsClaimable =
    BigInt(simulateData?.[0]?.transaction_trace?.execute_invocation?.result[2] ?? 0);

  const {
    sendAsync: claimRewards,
    isPending: claimIsSubmitting,
  } = useSendTransaction({
    calls:
      rewardPool && address
        ? [rewardPool.populate("claim", [recipient ?? address])]
        : undefined,
  });

  const handleClaimRewards = async () => {
    const hash = await claimRewards();
    toast({
      description: <div className="flex items-center gap-2">Claim Lords successful {hash.transaction_hash}</div>,
    });
  }

  return  (<Card>
  <CardHeader>
    <CardTitle>Claim Lords</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex gap-4">
      You have{" "}
      <span className="text-3xl font-bold">
        {lordsClaimable &&
          formatNumber(Number(formatEther(lordsClaimable)))}
      </span>{" "}
      Lords to claim
    </div>
    <Input placeholder="Recipient" value={recipient} onChange={(e) => setRecipient(e.target.value as Address)} />
  </CardContent>
  <CardFooter>
    <Button onClick={() => handleClaimRewards()} className="w-full" disabled={claimIsSubmitting}>
      Claim Lords
    </Button>
  </CardFooter>
</Card>)
};
