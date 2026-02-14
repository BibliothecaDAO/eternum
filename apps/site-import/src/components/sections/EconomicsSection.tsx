import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  lordsInfoQueryOptions,
  treasuryBalanceQueryOptions,
} from "@/lib/query-options";
import { getProposalsQueryOptions } from "@/lib/getProposals";
import { useVelords } from "@/hooks/use-velords";
import { StarknetProvider } from "@/hooks/starknet-provider";
import { LORDS_TOTAL_SUPPLY, PROPOSAL_QUORUM } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ProposalQuery } from "@/gql/graphql";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Coins,
  Landmark,
  TrendingUp,
  Tag,
  Percent,
  Zap,
  Lock,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { LordsFlywheel } from "@/components/ui/LordsFlywheel";

const appLoadTimestamp = Date.now();

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
  const { data: proposalsQuery } = useQuery(
    getProposalsQueryOptions({
      limit: 2,
      skip: 0,
      current: 1,
      searchQuery: "",
    })
  );

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

  const isActive = (proposal: ProposalQuery["proposal"]) =>
    proposal && proposal.max_end * 1000 > appLoadTimestamp;

  const getProposalStatus = (proposal: ProposalQuery["proposal"]) => {
    if (!proposal)
      return {
        status: "Unknown",
        icon: AlertCircle,
        color: "text-muted-foreground",
      };
    if (isActive(proposal))
      return { status: "Active", icon: Clock, color: "text-blue-500" };
    if (
      (proposal.scores_total ?? 0) >= PROPOSAL_QUORUM &&
      Number(proposal.scores_1 ?? 0) > Number(proposal.scores_2 ?? 0)
    )
      return { status: "Passed", icon: CheckCircle2, color: "text-green-500" };
    if ((proposal.scores_total ?? 0) < PROPOSAL_QUORUM)
      return {
        status: "No Quorum",
        icon: AlertCircle,
        color: "text-yellow-500",
      };
    return { status: "Failed", icon: XCircle, color: "text-red-500" };
  };

  return (
    <section className="realm-section container mx-auto px-4 py-16 md:py-24">
      <motion.div
        className="space-y-10"
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

        {/* LORDS Flywheel */}
        <LordsFlywheel />

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 lg:gap-8">
          {/* Left column - LORDS Token */}
          <motion.div
            className="realm-panel realm-edge-brackets rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-5 sm:p-6 space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h3 className="realm-banner">LORDS Token</h3>

            {/* Supply stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                {
                  label: "Total Supply",
                  value: LORDS_TOTAL_SUPPLY.toLocaleString(),
                  helper: "$LORDS",
                  icon: Coins,
                },
                {
                  label: "Treasury Share",
                  value:
                    treasuryLords > 0 ? `${treasuryPercentage}%` : "~40%",
                  helper: treasuryLords > 0 ? "Onchain" : "Estimated",
                  icon: Landmark,
                },
                {
                  label: "Market Share",
                  value:
                    treasuryLords > 0 ? `${marketPercentage}%` : "~60%",
                  helper: "Freely liquid",
                  icon: TrendingUp,
                },
                {
                  label: "Current Price",
                  value: lordsInfo?.price?.rate
                    ? `$${parseFloat(lordsInfo.price.rate).toFixed(4)}`
                    : "—",
                  helper: "Spot reference",
                  icon: Tag,
                },
              ] as { label: string; value: string; helper: string; icon: LucideIcon }[]).map((item) => (
                <div
                  key={item.label}
                  className="group/card relative rounded-xl border border-primary/15 bg-black/40 p-3.5 overflow-hidden transition-colors hover:border-primary/30"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 -translate-y-4 translate-x-4 opacity-[0.04]">
                    <item.icon className="w-full h-full" />
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <item.icon className="h-3 w-3 text-primary/60" />
                    <p className="realm-sigil">{item.label}</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold tabular-nums tracking-tight text-foreground/95">
                    {item.value}
                  </p>
                  <p className="text-[10px] text-foreground/45 mt-1">{item.helper}</p>
                </div>
              ))}
            </div>

            {/* Treasury breakdown */}
            <div className="rounded-xl border border-primary/10 bg-black/25 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 border border-primary/20">
                    <Landmark className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground/80">
                    DAO Treasury
                  </p>
                </div>
                <p className="text-xl font-bold text-primary tabular-nums">
                  {totalTreasuryBalance > 0
                    ? `$${(totalTreasuryBalance / 1_000_000).toFixed(2)}M`
                    : "—"}
                </p>
              </div>

              <div className="space-y-2.5">
                {treasuryData.map((asset) => {
                  const percentage =
                    totalTreasuryBalance > 0
                      ? (asset.value / totalTreasuryBalance) * 100
                      : 0;
                  return (
                    <div key={asset.name} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${asset.color} ring-2 ring-offset-1 ring-offset-black/50 ring-current/20`}
                          />
                          <span className="font-medium text-foreground/75">{asset.name}</span>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="text-foreground/50 tabular-nums">
                            {asset.amount.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="font-bold tabular-nums w-12 text-right">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className={`absolute left-0 top-0 h-full rounded-full ${asset.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Right column - Earn & Govern */}
          <motion.div
            className="realm-panel realm-edge-brackets rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-5 sm:p-6 space-y-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <h3 className="realm-banner">Earn & Govern</h3>

            {/* Staking stats */}
            <div className="grid grid-cols-2 gap-3">
              {([
                {
                  label: "Current APY",
                  value: currentAPY
                    ? `${currentAPY.toFixed(2)}%`
                    : "—",
                  icon: Percent,
                  highlight: true,
                },
                {
                  label: "Rewards This Week",
                  value: tokensThisWeek
                    ? `${tokensThisWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })} LORDS`
                    : "—",
                  icon: Zap,
                  highlight: false,
                },
                {
                  label: "LORDS Locked",
                  value: lordsLocked
                    ? lordsLocked.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })
                    : "—",
                  icon: Lock,
                  highlight: false,
                },
                {
                  label: "Staking TVL",
                  value: tvl
                    ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : "—",
                  icon: Shield,
                  highlight: false,
                },
              ] as { label: string; value: string; icon: LucideIcon; highlight: boolean }[]).map((item) => (
                <div
                  key={item.label}
                  className={`relative rounded-xl border bg-black/40 p-3.5 overflow-hidden transition-colors hover:border-primary/30 ${
                    item.highlight
                      ? "border-primary/30 bg-gradient-to-br from-primary/10 via-black/40 to-black/40"
                      : "border-primary/15"
                  }`}
                >
                  <div className="absolute top-0 right-0 w-14 h-14 -translate-y-3 translate-x-3 opacity-[0.04]">
                    <item.icon className="w-full h-full" />
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <item.icon className="h-3 w-3 text-primary/60" />
                    <p className="realm-sigil">{item.label}</p>
                  </div>
                  <p className={`text-lg sm:text-xl font-bold tabular-nums tracking-tight ${
                    item.highlight ? "text-primary" : "text-foreground/95"
                  }`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Explainer */}
            <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3">
              <p className="text-sm text-foreground/75 leading-relaxed">
                Game fees flow to veLORDS stakers weekly. Lock LORDS, earn protocol
                revenue, and vote on treasury allocation.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
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
                  View Proposals
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Proposals strip */}
        {proposalsQuery?.proposals && proposalsQuery.proposals.length > 0 && (
          <motion.div
            className="realm-panel rounded-2xl border border-primary/20 bg-black/25 p-5 sm:p-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="realm-banner">Recent Proposals</h3>
              <a
                href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                View All
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {proposalsQuery.proposals.map((proposal) => {
                const status = getProposalStatus(proposal);
                const StatusIcon = status.icon;
                return (
                  <div
                    key={proposal?.metadata?.title}
                    className="group/proposal rounded-xl border border-primary/15 bg-black/30 p-4 transition-colors hover:border-primary/25"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold line-clamp-1 mb-2 group-hover/proposal:text-primary/90 transition-colors">
                          {proposal?.metadata?.title}
                        </h4>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-current/15 px-2 py-0.5">
                          <StatusIcon
                            className={`w-3 h-3 ${status.color}`}
                          />
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${status.color}`}>
                            {status.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 rounded-lg bg-white/5 px-2.5 py-1.5">
                        <p className="text-base font-bold tabular-nums leading-tight">
                          {proposal?.scores_total || 0}
                        </p>
                        <p className="text-[9px] uppercase tracking-wider text-foreground/45">Votes</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
