import { VeLords } from "@/abi/L2/VeLords";
import { VeLordsRewardsChart } from "@/components/modules/velords/rewards-chart";
import { StakeLords } from "@/components/modules/velords/stake-lords";
import { trpc } from "@/router";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { StakingAddresses } from "@realms-world/constants";
import { Address } from "@starknet-react/core";
import { createFileRoute } from "@tanstack/react-router";
import { formatEther } from "viem";
import { useReadContract } from "wagmi";

export const Route = createFileRoute("/velords/")({
  component: RouteComponent,
  loader: async ({ context: { trpcQueryUtils } }) => {
    await trpcQueryUtils.posts.ensureData()
    return
  },
});

function RouteComponent() {
    const veLordsBurnsQuery = trpc.posts.useQuery()
    const veLordsBurns = veLordsBurnsQuery.data || []
    const {
        data: totalSupply,
        isFetching,
        error,
      } = useReadContract({
        address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as Address,
        abi: VeLords,
        functionName: "total_supply",
        //enabled: !!l2Address,
        args: [],
        // args: l2Address ? [l2Address] : undefined,
        //blockIdentifier: BlockTag.PENDING as BlockNumber,
      });
  return (
    <div className="container p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">veLords Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Stake $LORDS in the Lordship Protocol 
            </p>
          </div>
        </div>
        <div className="md:grids-col-2 grid md:gap-4 lg:grid-cols-10 xl:grid-cols-11 xl:gap-4">
          <div className="space-y-4 lg:col-span-4 xl:space-y-4">
            <StakeLords />
          </div>
          <div className="space-y-4 lg:col-span-7 xl:space-y-4">
            <VeLordsRewardsChart totalSupply={totalSupply && Number(formatEther(totalSupply))}
                data={veLordsBurns} />
          </div>
        </div>
      </div>
    </div>
  );
}
