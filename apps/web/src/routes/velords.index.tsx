import { lazy, Suspense, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { VelordsLockActivity } from "@/components/modules/velords/lock-activity";
import { VelordsSourceBreakdown } from "@/components/modules/velords/source-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useVelordsData } from "@/hooks/use-velords-data";
import {
  getVelordsLockActivityQueryOptions,
  getVelordsOverviewQueryOptions,
  getVelordsRewardsSeriesQueryOptions,
} from "@/lib/getVeLordsAnalytics";
import { getVelordsBurnsQueryOptions } from "@/lib/getVeLordsBurns";
import { calculateTrailingApyPercent } from "@/lib/velords-analytics";
import { seo } from "@/utils/seo";
import { formatNumber } from "@/utils/utils";
import { useAccount } from "@starknet-start/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Link2 } from "lucide-react";
import { formatUnits } from "viem";

type VelordsPeriod = "3m" | "6m" | "1y";
type VelordsView = "overview" | "sources" | "locks" | "trends";

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
const VelordsTrendsPanel = lazy(() =>
  import("@/components/modules/velords/trends-panel").then((mod) => ({
    default: mod.VelordsTrendsPanel,
  })),
);

function parsePeriod(period: unknown): VelordsPeriod {
  return period === "6m" || period === "1y" ? period : "3m";
}

function parseView(view: unknown): VelordsView {
  if (view === "sources") return "sources";
  if (view === "locks") return "locks";
  if (view === "trends") return "trends";
  return "overview";
}

function periodToStartDate(period: VelordsPeriod): Date {
  const now = Date.now();
  const periods: Record<VelordsPeriod, number> = {
    "3m": 3 * 30 * 24 * 60 * 60 * 1000,
    "6m": 6 * 30 * 24 * 60 * 60 * 1000,
    "1y": 12 * 30 * 24 * 60 * 60 * 1000,
  };
  return new Date(now - periods[period]);
}

function formatWeiAmount(value?: string, maximumFractionDigits = 0): string | undefined {
  if (!value) return undefined;
  return formatNumber(Number(formatUnits(BigInt(value), 18)), maximumFractionDigits);
}

export const Route = createFileRoute("/velords/")({
  validateSearch: (search: Record<string, unknown>) => ({
    period: parsePeriod(search.period),
    view: parseView(search.view),
    source: typeof search.source === "string" && search.source.trim().length > 0 ? search.source : undefined,
  }),
  head: () => ({
    meta: [
      ...seo({
        title: "RW | veLords Dashboard",
        description: "Track veLords rewards, lock activity, and your staking position.",
        image: "/icon.svg",
      }),
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { toast } = useToast();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const selectedPeriod = search.period;
  const selectedView = search.view;
  const startTimestamp = useMemo(() => periodToStartDate(selectedPeriod), [selectedPeriod]);

  const veLordsBurnsQuery = useQuery(
    getVelordsBurnsQueryOptions({
      startTimestamp,
      sender: search.source,
    }),
  );
  const overviewQuery = useQuery(
    getVelordsOverviewQueryOptions({
      period: selectedPeriod,
      source: search.source,
    }),
  );
  const rewardsSeriesQuery = useQuery(
    getVelordsRewardsSeriesQueryOptions({
      period: selectedPeriod,
      source: search.source,
    }),
  );
  const lockActivityQuery = useQuery(
    getVelordsLockActivityQueryOptions({
      period: selectedPeriod,
    }),
  );
  const { address } = useAccount();
  const velordsData = useVelordsData();

  const { totalSupply, totalSupplyRaw, lordsLocked, tvl, isTVLLoading, userBalance, userSharePercent, userLocked } =
    velordsData;

  const trailingApy = useMemo(() => {
    const weekly = rewardsSeriesQuery.data?.weekly ?? [];
    const trailingWeeks = weekly.slice(-4).map((row) => row.totalWei);
    return calculateTrailingApyPercent(trailingWeeks, totalSupplyRaw);
  }, [rewardsSeriesQuery.data?.weekly, totalSupplyRaw]);

  const estimatedWeeklyRewards = useMemo(() => {
    const latestWeek = rewardsSeriesQuery.data?.weekly.at(-1);
    if (!latestWeek || !userSharePercent) return undefined;
    const latestWeekRewards = Number(formatUnits(BigInt(latestWeek.totalWei), 18));
    return (latestWeekRewards * Number(userSharePercent)) / 100;
  }, [rewardsSeriesQuery.data?.weekly, userSharePercent]);

  const rewards7d = formatWeiAmount(overviewQuery.data?.rewards7dWei, 2);
  const rewards30d = formatWeiAmount(overviewQuery.data?.rewards30dWei, 2);

  const handleTimePeriodChange = (period: VelordsPeriod) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        period,
      }),
    });
  };

  const handleViewChange = (view: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        view: parseView(view),
      }),
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ description: "veLords dashboard link copied." });
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Unable to copy link.",
      });
    }
  };

  const handleCopySummary = async () => {
    const summary = [
      `veLords Dashboard (${selectedPeriod})`,
      `TVL: ${
        typeof tvl === "number" && Number.isFinite(tvl)
          ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          : "$0"
      }`,
      `Locked: ${lordsLocked ?? "0"} LORDS`,
      `30d Rewards: ${rewards30d ?? "0"} LORDS`,
      `APY: ${formatNumber(trailingApy, 2)}%`,
      `Updated: ${new Date().toISOString().slice(0, 10)}`,
    ].join(" | ");

    try {
      await navigator.clipboard.writeText(summary);
      toast({ description: "veLords summary copied." });
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Unable to copy summary.",
      });
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader
          eyebrow="Lords"
          title="veLords Dashboard"
          description="Stake $LORDS in the Lordship Protocol and monitor reward performance."
          actions={
            <>
              <Button variant="outline" onClick={handleCopyLink}>
                <Link2 className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button variant="outline" onClick={handleCopySummary}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Summary
              </Button>
            </>
          }
        />

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Total Voting Power (veLORDS)"
            value={totalSupply ?? "Loading..."}
            hint={
              userBalance !== undefined && userSharePercent !== undefined
                ? `Your share: ${userBalance} (${userSharePercent}%)`
                : undefined
            }
          />
          <MetricCard label="LORDS Locked" value={lordsLocked ?? "Loading..."} />
          <MetricCard
            label="TVL"
            value={
              typeof tvl === "number" && Number.isFinite(tvl)
                ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : isTVLLoading
                  ? "Loading..."
                  : "$0"
            }
          />
          <MetricCard label="Rewards (7d)" value={rewards7d ?? "Loading..."} />
          <MetricCard label="Rewards (30d)" value={rewards30d ?? "Loading..."} />
          <MetricCard label="Trailing APY (4w avg)" value={`${formatNumber(trailingApy, 2)}%`} />
        </div>

        <div className="grid gap-6 lg:gap-8 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <Card>
              <CardContent className="p-6">
                <Suspense fallback={<div className="h-[360px] w-full animate-pulse rounded-md border" />}>
                  <VeLordsRewardsChart
                    selectedPeriod={selectedPeriod}
                    totalSupplyRaw={totalSupplyRaw}
                    data={veLordsBurnsQuery.data ?? []}
                    onTimePeriodChange={handleTimePeriodChange}
                    isLoading={veLordsBurnsQuery.isLoading}
                    errorMessage={
                      veLordsBurnsQuery.error instanceof Error ? veLordsBurnsQuery.error.message : undefined
                    }
                  />
                </Suspense>
              </CardContent>
            </Card>

            <Tabs value={selectedView} onValueChange={handleViewChange}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="locks">Locks</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="grid gap-6 lg:grid-cols-2">
                  <VelordsSourceBreakdown
                    data={rewardsSeriesQuery.data?.sources ?? []}
                    isLoading={rewardsSeriesQuery.isLoading}
                  />
                  <VelordsLockActivity
                    data={lockActivityQuery.data?.weekly ?? []}
                    isLoading={lockActivityQuery.isLoading}
                  />
                </div>
              </TabsContent>
              <TabsContent value="sources">
                <VelordsSourceBreakdown
                  data={rewardsSeriesQuery.data?.sources ?? []}
                  isLoading={rewardsSeriesQuery.isLoading}
                />
              </TabsContent>
              <TabsContent value="locks">
                <VelordsLockActivity
                  data={lockActivityQuery.data?.weekly ?? []}
                  isLoading={lockActivityQuery.isLoading}
                />
              </TabsContent>
              <TabsContent value="trends">
                <Suspense fallback={<div className="h-[640px] w-full animate-pulse rounded-md border" />}>
                  <VelordsTrendsPanel
                    rewardsWeekly={rewardsSeriesQuery.data?.weekly ?? []}
                    lockWeekly={lockActivityQuery.data?.weekly ?? []}
                    isRewardsLoading={rewardsSeriesQuery.isLoading}
                    isLocksLoading={lockActivityQuery.isLoading}
                  />
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Your Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <div>veLORDS Balance: {userBalance ?? "-"}</div>
                  <div>Supply Share: {userSharePercent ? `${userSharePercent}%` : "-"}</div>
                  <div>Locked LORDS: {userLocked?.amount ?? "-"}</div>
                  <div>
                    Unlock Time:{" "}
                    {userLocked?.unlockTime ? new Date(userLocked.unlockTime * 1000).toLocaleDateString() : "-"}
                  </div>
                  <div>
                    Est. Weekly Rewards:{" "}
                    {estimatedWeeklyRewards !== undefined ? `~${formatNumber(estimatedWeeklyRewards, 2)} LORDS` : "-"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <Suspense fallback={<div className="h-[320px] w-full animate-pulse rounded-md border" />}>
                <StakeLords />
              </Suspense>
            </Card>
            {address && (
              <Card>
                <Suspense fallback={<div className="h-[220px] w-full animate-pulse rounded-md border" />}>
                  <VelordsRewards />
                </Suspense>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
