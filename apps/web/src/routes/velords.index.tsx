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
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {/* Header Section */}
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            veLords Dashboard
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Stake $LORDS in the Lordship Protocol
          </p>
          {error && (
            <div className="bg-destructive/10 rounded-md p-3">
              <p className="text-destructive text-sm font-medium">
                {error.message}
              </p>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:gap-8 xl:grid-cols-5">
          {/* Left Column - Staking Controls */}
          <div className="space-y-6 xl:col-span-2">
            <div className="bg-card rounded-lg border">
              <StakeLords />
            </div>
            <div className="bg-card rounded-lg border">
              <VelordsRewards />
            </div>
          </div>

          {/* Right Column - Chart */}
          <div className="xl:col-span-3">
            <div className="bg-card rounded-lg border p-6">
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
    </div>
  );
}
