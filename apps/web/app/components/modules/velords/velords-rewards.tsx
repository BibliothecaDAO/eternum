import type { Address } from "@starknet-react/core";
import type { Call } from "starknet";
import { useMemo, useState } from "react";
import { RewardPool } from "@/abi/L2/RewardPool";
import LordsIcon from "@/components/icons/lords.svg?react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useSimulateTransactions } from "@/hooks/useSimulateTransactions";
import { formatNumber, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import {
  useAccount,
  useContract,
  useSendTransaction,
} from "@starknet-react/core";
import { formatEther } from "viem";

import { StakingAddresses } from "@realms-world/constants";

export const VelordsRewards = () => {
  const { address } = useAccount();

  const rewardPoolAddress = StakingAddresses.rewardpool[SUPPORTED_L2_CHAIN_ID];
  const [recipient, setRecipient] = useState<Address | undefined>(undefined);
  const { contract: rewardPool } = useContract({
    abi: RewardPool,
    address: rewardPoolAddress as Address,
  });

  // Create the call to claim rewards. If no recipient is provided, use the current account.
  const claimCall: Call[] | undefined = useMemo(() => {
    const finalRecipient = recipient ?? address;
    return finalRecipient != undefined && rewardPool
      ? [rewardPool.populate("claim", [finalRecipient])]
      : undefined;
  }, [address, rewardPool, recipient]);

  // Get simulation data for claim rewards (if available).
  const { data: simulateData } = useSimulateTransactions({
    calls: claimCall,
  });
  const lordsClaimable = BigInt(
    simulateData?.[0]?.transaction_trace?.execute_invocation?.result[2] ?? 0,
  );

  // Setup sending claim reward transaction.
  const { sendAsync: claimRewards, isPending: claimIsSubmitting } =
    useSendTransaction({
      calls: claimCall,
    });

  // Handle the claim rewards click event.
  const handleClaimRewards = async () => {
    const hash = await claimRewards();

    toast({
      description: (
        <div className="flex items-center gap-2">
          Claim Lords successful {hash.transaction_hash}
        </div>
      ),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Claimable Lords</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <LordsIcon className="w-9" />
            <span className="text-3xl font-bold">
              {lordsClaimable &&
                formatNumber(Number(formatEther(lordsClaimable)))}
            </span>{" "}
            Lords to claim.
          </div>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button className="p-0" variant={"link"}>
                Change Recipient
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Input
                placeholder="Recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value as Address)}
              />
            </CollapsibleContent>
          </Collapsible>
          <Button
            onClick={handleClaimRewards}
            className="w-full"
            disabled={claimIsSubmitting}
          >
            Claim Lords
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Rewards for veLords are distributed at weekly epochs
        </div>
      </CardFooter>
    </Card>
  );
};
