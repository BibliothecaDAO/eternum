import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  lordsInfoQueryOptions,
  treasuryBalanceQueryOptions,
} from "@/lib/query-options";
import { useVelords } from "@/hooks/use-velords";
import { StarknetProvider } from "@/hooks/starknet-provider";
import { LORDS_TOTAL_SUPPLY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Coins,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { LordsFlywheel } from "@/components/ui/LordsFlywheel";

export function EconomicsSection() {
  return (
    <StarknetProvider>
      <EconomicsSectionContent />
    </StarknetProvider>
  );
}

function EconomicsSectionContent() {
  const { currentAPY, tokensThisWeek, lordsLocked, tvl } = useVelords();
  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());
  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());

  const treasuryLords = treasuryBalance?.LORDS.amount || 0;
  const treasuryPercentage = (
    (treasuryLords / LORDS_TOTAL_SUPPLY) *
    100
  ).toFixed(1);
  const marketPercentage = (100 - parseFloat(treasuryPercentage)).toFixed(1);

  const totalTreasuryBalance =
    (treasuryBalance?.LORDS.usdValue ?? 0) +
    (treasuryBalance?.ETH.usdValue ?? 0) +
    (treasuryBalance?.WETH.usdValue ?? 0) +
    (treasuryBalance?.USDC.usdValue ?? 0);

  const treasuryData = [
    {
      name: "LORDS",
      value: treasuryBalance?.LORDS.usdValue ?? 0,
      amount: treasuryBalance?.LORDS.amount ?? 0,
      color: "bg-primary",
    },
    {
      name: "ETH + WETH",
      value:
        (treasuryBalance?.ETH.usdValue ?? 0) +
        (treasuryBalance?.WETH.usdValue ?? 0),
      amount:
        (treasuryBalance?.ETH.amount ?? 0) +
        (treasuryBalance?.WETH.amount ?? 0),
      color: "bg-blue-500",
    },
    {
      name: "USDC",
      value: treasuryBalance?.USDC.usdValue ?? 0,
      amount: treasuryBalance?.USDC.amount ?? 0,
      color: "bg-green-500",
    },
  ];

  const heroMetrics = [
    {
      label: "LORDS Price",
      value: lordsInfo?.price?.rate
        ? `$${parseFloat(lordsInfo.price.rate).toFixed(4)}`
        : "—",
      highlight: false,
    },
    {
      label: "Staking APY",
      value: currentAPY ? `${currentAPY.toFixed(1)}%` : "—",
      highlight: true,
    },
    {
      label: "Total Value Locked",
      value: tvl
        ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : "—",
      highlight: false,
    },
  ];

  return (
    <section className="realm-section container mx-auto px-4 py-16 md:py-24">
      <motion.div
        className="space-y-8 md:space-y-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <p className="realm-banner">Economics</p>
          <h2 className="realm-title text-3xl sm:text-4xl md:text-5xl">
            $LORDS Token & Treasury
          </h2>
          <p className="realm-subtitle text-base sm:text-lg">
            A liquid token model designed for gameplay economies, governance, and
            long-term ecosystem alignment.
          </p>
        </motion.div>

        {/* Hero Metrics */}
        <motion.div
          className="grid grid-cols-3 rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {heroMetrics.map((metric, i) => (
            <div
              key={metric.label}
              className={`p-4 sm:p-6 md:p-8 text-center ${
                i > 0 ? "border-l border-primary/10" : ""
              }`}
            >
              <p className="realm-sigil mb-2">{metric.label}</p>
              <p
                className={`text-xl sm:text-2xl md:text-4xl font-bold tabular-nums tracking-tight ${
                  metric.highlight ? "text-primary" : "text-foreground/95"
                }`}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* LORDS Flywheel with embedded data */}
        <LordsFlywheel
          metrics={{
            weeklyRewards: tokensThisWeek
              ? `${tokensThisWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })} LORDS`
              : undefined,
            lordsLocked: lordsLocked
              ? lordsLocked.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })
              : undefined,
            currentAPY: currentAPY
              ? `${currentAPY.toFixed(1)}%`
              : undefined,
          }}
        />

        {/* Token & Treasury — full width */}
        <motion.div
          className="realm-panel realm-edge-brackets rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-5 sm:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left: Supply snapshot */}
            <div className="space-y-4">
              <h3 className="realm-banner">Token Supply</h3>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    {
                      label: "Total Supply",
                      value: "300M",
                      sub: "$LORDS",
                      icon: Coins,
                    },
                    {
                      label: "Treasury",
                      value:
                        treasuryLords > 0 ? `${treasuryPercentage}%` : "~40%",
                      sub: treasuryLords > 0 ? "Onchain" : "Estimated",
                      icon: Landmark,
                    },
                    {
                      label: "Circulating",
                      value:
                        treasuryLords > 0 ? `${marketPercentage}%` : "~60%",
                      sub: "Freely liquid",
                      icon: TrendingUp,
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-primary/15 bg-black/40 p-3.5"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <item.icon className="h-3 w-3 text-primary/60" />
                      <p className="realm-sigil">{item.label}</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums tracking-tight text-foreground/95">
                      {item.value}
                    </p>
                    <p className="text-[10px] text-foreground/60 mt-1">
                      {item.sub}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Treasury composition */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="realm-banner">DAO Treasury</h3>
                <p className="text-xl font-bold text-primary tabular-nums">
                  {totalTreasuryBalance > 0
                    ? `$${(totalTreasuryBalance / 1_000_000).toFixed(2)}M`
                    : "—"}
                </p>
              </div>

              {/* Stacked bar */}
              <div className="space-y-3">
                <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden flex">
                  {treasuryData.map((asset) => {
                    const percentage =
                      totalTreasuryBalance > 0
                        ? (asset.value / totalTreasuryBalance) * 100
                        : 0;
                    return (
                      <motion.div
                        key={asset.name}
                        className={`h-full ${asset.color} first:rounded-l-full last:rounded-r-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {treasuryData.map((asset) => {
                    const percentage =
                      totalTreasuryBalance > 0
                        ? (asset.value / totalTreasuryBalance) * 100
                        : 0;
                    return (
                      <div
                        key={asset.name}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${asset.color}`}
                        />
                        <span className="font-medium text-foreground/75">
                          {asset.name}
                        </span>
                        <span className="tabular-nums text-foreground/50">
                          {asset.amount.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="font-bold tabular-nums text-foreground/70">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stake CTA Bar */}
        <motion.div
          className="rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent backdrop-blur-sm p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div>
            <p className="text-lg sm:text-xl font-bold">
              Earn{" "}
              <span className="text-primary">
                {currentAPY ? `${currentAPY.toFixed(1)}%` : "—"}
              </span>{" "}
              APY
            </p>
            <p className="text-sm text-foreground/60 mt-1">
              Lock LORDS as veLORDS — earn weekly protocol fees and vote on
              treasury allocation.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button size="lg" variant="war" asChild>
              <a
                href="https://staking.realms.world"
                target="_blank"
                rel="noopener noreferrer"
              >
                Stake LORDS
              </a>
            </Button>
            <Button size="lg" variant="oath" asChild>
              <a
                href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
                target="_blank"
                rel="noopener noreferrer"
              >
                Governance
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
