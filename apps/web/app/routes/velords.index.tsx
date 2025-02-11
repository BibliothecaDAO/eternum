import type { Address } from "@starknet-react/core";
import { VeLords } from "@/abi/L2/VeLords";
import { VeLordsRewardsChart } from "@/components/modules/velords/rewards-chart";
import { StakeLords } from "@/components/modules/velords/stake-lords";
import { VelordsRewards } from "@/components/modules/velords/velords-rewards";
import { trpc } from "@/router";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useReadContract } from "@starknet-react/core";
import { createFileRoute } from "@tanstack/react-router";
import { formatEther } from "viem";

import { StakingAddresses } from "@realms-world/constants";

export const Route = createFileRoute("/velords/")({
  component: RouteComponent,
  loader: async ({ context: { trpcQueryUtils } }) => {
    await trpcQueryUtils.posts.ensureData();
    return;
  },
});

function RouteComponent() {
  const veLordsBurnsQuery = trpc.velordsBurns.useQuery({});
  const veLordsBurns = veLordsBurnsQuery.data ?? [];
  const { data: totalSupply } = useReadContract({
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as Address,
    abi: VeLords,
    functionName: "total_supply",
    args: [],
  });
  return (
    <div className="container p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">veLords Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Stake $LORDS in the Lordship Protocol
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-4">
            <StakeLords />
            <VelordsRewards />
          </div>
          <div className="col-span-3">
            <VeLordsRewardsChart
              totalSupply={
                totalSupply
                  ? Number(formatEther(totalSupply as bigint))
                  : undefined
              }
              data={veLordsBurns}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
