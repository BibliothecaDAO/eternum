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
  const { currentAPY, tokensThisWeek, lordsLocked } = useVelords();
  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());
  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());

  const treasuryLords = treasuryBalance?.LORDS.amount || 0;
  const treasuryPercentage = (
    (treasuryLords / LORDS_TOTAL_SUPPLY) *
    100
  ).toFixed(1);
  const marketPercentage = (100 - parseFloat(treasuryPercentage)).toFixed(1);

  const parsedLordsPrice = Number.parseFloat(lordsInfo?.price?.rate ?? "");
  const lordsLockedUsd =
    Number.isFinite(parsedLordsPrice) && typeof lordsLocked === "number"
      ? lordsLocked * parsedLordsPrice
      : null;

  const heroMetrics = [
    {
      label: "LORDS Price",
      value: Number.isFinite(parsedLordsPrice)
        ? `$${parsedLordsPrice.toFixed(4)}`
        : "—",
      highlight: false,
    },
    {
      label: "Staking APY",
      value: typeof currentAPY === "number" ? `${currentAPY.toFixed(1)}%` : "—",
      highlight: true,
    },
    {
      label: "Total Value Locked",
      value: typeof lordsLockedUsd === "number"
        ? `$${lordsLockedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : "—",
      highlight: false,
    },
  ];

  const supplyStats = [
    {
      label: "Total Supply",
      value: "300M",
      sub: "$LORDS",
      icon: Coins,
    },
    {
      label: "Treasury",
      value: treasuryLords > 0 ? `${treasuryPercentage}%` : "~40%",
      sub: treasuryLords > 0 ? "Onchain" : "Estimated",
      icon: Landmark,
    },
    {
      label: "Circulating",
      value: treasuryLords > 0 ? `${marketPercentage}%` : "~60%",
      sub: "Freely liquid",
      icon: TrendingUp,
    },
  ] as const;

  return (
    <section className="realm-section container mx-auto px-4 py-16 md:py-24">
      <motion.div
        className="space-y-8 md:space-y-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="mx-auto max-w-3xl space-y-4 text-center"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <p className="realm-banner mx-auto flex w-fit">
            <Coins className="h-3.5 w-3.5" />
            ECONOMICS
          </p>
          <h2 className="realm-title text-2xl sm:text-3xl md:text-4xl">
            $LORDS TOKEN & TREASURY
          </h2>
          <p className="realm-subtitle text-base sm:text-lg">
            An ecosystem token designed for real-stakes gameplay economies and
            long-term studio alignment.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-3 overflow-hidden rounded-lg border border-primary/20 bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {heroMetrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`p-4 text-center sm:p-6 md:p-8 ${
                index > 0 ? "border-l border-primary/10" : ""
              }`}
            >
              <p className="realm-sigil mb-2">{metric.label}</p>
              <p
                className={`text-xl font-bold tabular-nums tracking-tight sm:text-2xl md:text-4xl ${
                  metric.highlight ? "text-primary" : "text-foreground/95"
                }`}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </motion.div>

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
            currentAPY: typeof currentAPY === "number"
              ? `${currentAPY.toFixed(1)}%`
              : undefined,
          }}
        />

        <motion.div
          className="realm-panel realm-edge-brackets mx-auto max-w-4xl rounded-lg border border-primary/20 bg-black/30 p-5 text-center backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="mx-auto space-y-4">
            <h3 className="realm-banner mx-auto flex w-fit text-center">
              TOKEN SUPPLY
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {supplyStats.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center rounded-lg border border-primary/15 bg-black/40 p-4 text-center"
                >
                  <div className="mb-2 flex items-center justify-center gap-1.5">
                    <item.icon className="h-3 w-3 text-primary/60" />
                    <p className="realm-sigil">{item.label}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums tracking-tight text-foreground/95">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[10px] text-foreground/60">
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-4 rounded-lg border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div>
            <p className="text-lg font-bold sm:text-xl">
              Earn{" "}
              <span className="text-primary">
                {typeof currentAPY === "number" ? `${currentAPY.toFixed(1)}%` : "—"}
              </span>{" "}
              APY
            </p>
            <p className="mt-1 text-sm text-foreground/60">
              Lock LORDS as veLORDS and earn weekly staking rewards.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button size="lg" variant="war" asChild>
              <a
                href="https://account.realms.world/velords"
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
