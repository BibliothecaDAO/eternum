import type { Address } from "@starknet-react/core";
import { VeLords } from "@/abi/L2/VeLords";
import { VelordsRewards } from "@/components/modules/velords/claim-rewards";
import { VeLordsRewardsChart } from "@/components/modules/velords/rewards-chart";
import { StakeLords } from "@/components/modules/velords/stake-lords";
import { getVelordsBurnsQueryOptions } from "@/lib/getVeLordsBurns";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useReadContract } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatEther } from "viem";

import { StakingAddresses } from "@realms-world/constants";

export const Route = createFileRoute("/velords/")({
  component: RouteComponent,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getVelordsBurnsQueryOptions({}));
  },
});

function RouteComponent() {
  const veLordsBurnsQuery = useQuery(getVelordsBurnsQueryOptions({}));
  const veLordsBurns = veLordsBurnsQuery.data ?? [];
  const { data: totalSupply, error } = useReadContract({
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as Address,
    abi: VeLords,
    functionName: "total_supply",
    args: [],
  });
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">veLords Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Stake $LORDS in the Lordship Protocol
            </p>
            {error && <p className="text-red-500">{error.message}</p>}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-4">
            <StakeLords />
            <VelordsRewards />
          </div>
          <div className="lg:col-span-8">
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
