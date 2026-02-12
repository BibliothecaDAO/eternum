import { lazy, Suspense, useMemo, useState } from "react";
import { useVelordsData } from "@/hooks/use-velords-data";
import { getVelordsBurnsQueryOptions } from "@/lib/getVeLordsBurns";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

const VeLordsRewardsChart = lazy(() =>
  import("@/components/modules/velords/rewards-chart").then((mod) => ({
    default: mod.VeLordsRewardsChart,
  })),
);
const StakeLords = lazy(() =>
  import("@/components/modules/velords/stake-lords").then((mod) => ({
    default: mod.StakeLords,
  })),
);
const VelordsRewards = lazy(() =>
  import("@/components/modules/velords/claim-rewards").then((mod) => ({
    default: mod.VelordsRewards,
  })),
);

export const Route = createFileRoute("/velords/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [selectedPeriod, setSelectedPeriod] = useState<"3m" | "6m" | "1y">("3m");

  const startTimestamp = useMemo(() => {
    const now = Date.now();
    const periods = {
      "3m": 3 * 30 * 24 * 60 * 60 * 1000, // 3 months
      "6m": 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
      "1y": 12 * 30 * 24 * 60 * 60 * 1000, // 1 year
    };
    return new Date(now - periods[selectedPeriod]);
  }, [selectedPeriod]);

  const veLordsBurnsQuery = useQuery(
    getVelordsBurnsQueryOptions({ startTimestamp }),
  );
  const veLordsBurns = veLordsBurnsQuery.data ?? [];
  const { address } = useAccount();
  const velordsData = useVelordsData();
  const {
    totalSupply,
    totalSupplyRaw,
    lordsLocked,
    tvl,
    isTVLLoading,
    userBalance,
    userSharePercent,
  } = velordsData;

  const handleTimePeriodChange = (period: "3m" | "6m" | "1y") => {
    setSelectedPeriod(period);
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {/* Header Section */}
        <div className="mb-8 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              veLords Dashboard
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Stake $LORDS in the Lordship Protocol
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:gap-8 xl:grid-cols-5">
          {/* Right Column - Data Cards and Chart */}
          <div className="space-y-6 xl:col-span-3">
            {/* Key Metrics */}
            <div className="mb-8 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Total Voting Power (veLORDS)</div>
                  <div className="text-2xl font-bold">
                    {totalSupply ?? "Loading..."}
                  </div>
                  {userBalance !== undefined && userSharePercent !== undefined && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Your share: {userBalance} ({userSharePercent}%)
                    </div>
                  )}
                </div>
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">LORDS Locked</div>
                  <div className="text-2xl font-bold">
                    {lordsLocked ?? "Loading..."}
                  </div>
                </div>
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">TVL</div>
                  <div className="text-2xl font-bold">
                    {typeof tvl === "number" && !isNaN(tvl)
                      ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : isTVLLoading
                        ? "Loading..."
                        : "$0"
                    }
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-lg border p-6">
              <Suspense fallback={<div className="h-[360px] w-full animate-pulse rounded-md border" />}>
                <VeLordsRewardsChart
                  totalSupplyRaw={totalSupplyRaw}
                  data={veLordsBurns}
                  onTimePeriodChange={handleTimePeriodChange}
                  isLoading={veLordsBurnsQuery.isLoading}
                  errorMessage={
                    veLordsBurnsQuery.error instanceof Error
                      ? veLordsBurnsQuery.error.message
                      : undefined
                  }
                />
              </Suspense>
            </div>
          </div>

          {/* Left Column - Staking Controls and Claimable Rewards */}
          <div className="space-y-6 xl:col-span-2">
            <div className="bg-card rounded-lg border">
              <Suspense
                fallback={
                  <div className="h-[320px] w-full animate-pulse rounded-md border" />
                }
              >
                <StakeLords />
              </Suspense>
            </div>
            {address && (
              <div className="bg-card rounded-lg border">
                <Suspense
                  fallback={
                    <div className="h-[220px] w-full animate-pulse rounded-md border" />
                  }
                >
                  <VelordsRewards />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
