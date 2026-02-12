import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getProposalsQueryOptions } from "@/lib/getProposals";
import { treasuryBalanceQueryOptions } from "@/lib/query-options";
import { ProposalQuery } from "@/gql/graphql";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Coins,
  Vote,
  TrendingUp,
  Users,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Wallet,
  PieChart,
  Gamepad2,
} from "lucide-react";

const appLoadTimestamp = Date.now();

export function TreasurySection() {
  const { data: proposalsQuery } = useQuery(
    getProposalsQueryOptions({
      limit: 3,
      skip: 0,
      current: 1,
      searchQuery: "",
    })
  );

  const isActive = (proposal: ProposalQuery["proposal"]) =>
    proposal && proposal.max_end * 1000 > appLoadTimestamp;

  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());

  const totalTreasuryBalance =
    (treasuryBalance?.LORDS.usdValue ?? 0) +
    (treasuryBalance?.ETH.usdValue ?? 0) +
    (treasuryBalance?.WETH.usdValue ?? 0) +
    (treasuryBalance?.USDC.usdValue ?? 0);

  const getProposalStatus = (proposal: ProposalQuery["proposal"]) => {
    if (!proposal)
      return {
        status: "Unknown",
        icon: AlertCircle,
        color: "text-muted-foreground",
      };

    if (isActive(proposal)) {
      return { status: "Active", icon: Clock, color: "text-blue-500" };
    }

    if (
      (proposal.scores_total ?? 0) >= 1500 &&
      Number(proposal.scores_1 ?? 0) > Number(proposal.scores_2 ?? 0)
    ) {
      return { status: "Passed", icon: CheckCircle2, color: "text-green-500" };
    } else if ((proposal.scores_total ?? 0) < 1500) {
      return {
        status: "Quorum not met",
        icon: AlertCircle,
        color: "text-yellow-500",
      };
    } else {
      return { status: "Failed", icon: XCircle, color: "text-red-500" };
    }
  };

  // Treasury allocation data for visualization
  const treasuryData = [
    {
      name: "LORDS",
      value: treasuryBalance?.LORDS.usdValue ?? 0,
      amount: treasuryBalance?.LORDS.amount ?? 0,
      color: "bg-primary",
      percentage:
        ((treasuryBalance?.LORDS.usdValue ?? 0) / totalTreasuryBalance) * 100,
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
      percentage:
        (((treasuryBalance?.ETH.usdValue ?? 0) +
          (treasuryBalance?.WETH.usdValue ?? 0)) /
          totalTreasuryBalance) *
        100,
    },
    {
      name: "USDC",
      value: treasuryBalance?.USDC.usdValue ?? 0,
      amount: treasuryBalance?.USDC.amount ?? 0,
      color: "bg-green-500",
      percentage:
        ((treasuryBalance?.USDC.usdValue ?? 0) / totalTreasuryBalance) * 100,
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 sm:py-24">
      <motion.div
        className="space-y-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold">
            DAO Treasury & Governance
          </h2>
          <p className="text-xl text-muted-foreground">
            Community-controlled treasury managed through decentralized
            governance. Every Realm holder has a voice in shaping the
            ecosystem's future.
          </p>
        </motion.div>

        {/* Key Stats */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <Card className="backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Treasury
                  </p>
                  <p className="text-2xl font-bold">
                    ${(totalTreasuryBalance / 1000000).toFixed(2)}M
                  </p>
                </div>
                <Wallet className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Voting Power</p>
                  <p className="text-2xl font-bold">1 Realm = 1 Vote</p>
                </div>
                <Vote className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Realms</p>
                  <p className="text-2xl font-bold">8,000</p>
                </div>
                <Users className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Proposals</p>
                  <p className="text-2xl font-bold">
                    {proposalsQuery?.proposals?.length || 0} Active
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Treasury Breakdown */}
          <motion.div
            className="space-y-6"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <Card className="backdrop-blur-md border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <PieChart className="w-6 h-6" />
                      Treasury Allocation
                    </CardTitle>
                    <CardDescription>
                      Diversified assets for ecosystem sustainability
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-2xl font-bold">
                      ${totalTreasuryBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Visual Treasury Breakdown */}
                <div className="space-y-4">
                  {treasuryData.map((asset) => (
                    <div key={asset.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${asset.color}`}
                          />
                          <span className="font-medium">{asset.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {asset.amount.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ${asset.value.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={`absolute left-0 top-0 h-full ${asset.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${asset.percentage}%` }}
                          transition={{ duration: 1, delay: 0.8 }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {asset.percentage.toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>

                {/* Treasury Purpose */}
                <div className="pt-6 border-t space-y-3">
                  <h4 className="font-semibold">Treasury Purpose</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Gamepad2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Development</p>
                        <p className="text-xs text-muted-foreground">
                          Fund ecosystem development and new game creation
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Coins className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Liquidity</p>
                        <p className="text-xs text-muted-foreground">
                          Provide liquidity for DEXs and game economies
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Community</p>
                        <p className="text-xs text-muted-foreground">
                          Support community initiatives and grants
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Security</p>
                        <p className="text-xs text-muted-foreground">
                          Emergency reserves for protocol security
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: Governance */}
          <motion.div
            className="space-y-6"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            {/* Governance Model */}
            <Card className="backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Vote className="w-6 h-6" />
                  Governance Model
                </CardTitle>
                <CardDescription>
                  How decisions are made in the Realms ecosystem
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Who Can Vote
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Any wallet holding at least 1 Realm NFT
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-primary" />
                      Quorum Required
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      1,500 Realms must participate
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Voting Period
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Typically 7 days per proposal
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      Pass Threshold
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Simple majority (&gt;50%)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Proposals */}
            <Card className="backdrop-blur-md border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Recent Proposals</CardTitle>
                    <CardDescription>
                      Latest governance activities
                    </CardDescription>
                  </div>
                  <a
                    href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-2">
                      View All
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proposalsQuery?.proposals?.map((proposal) => {
                    const status = getProposalStatus(proposal);
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={proposal?.metadata?.title}
                        className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <h4 className="font-medium line-clamp-1">
                              {proposal?.metadata?.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              <StatusIcon
                                className={`w-4 h-4 ${status.color}`}
                              />
                              <span className={`text-sm ${status.color}`}>
                                {status.status}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {proposal?.scores_total || 0}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Votes
                            </p>
                          </div>
                        </div>
                        {proposal &&
                          !isActive(proposal) &&
                          proposal.scores_1 &&
                          proposal.scores_2 && (
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>For</span>
                                <span className="text-green-500">
                                  {Math.round(proposal.scores_1)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Against</span>
                                <span className="text-red-500">
                                  {Math.round(proposal.scores_2)}
                                </span>
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Call to Action */}
        <motion.div
          className="text-center space-y-4 pt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          <h3 className="text-2xl font-bold">Get Involved in Governance</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join the community and help shape the future of onchain gaming. Your
            voice matters in the Realms ecosystem.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2">
                View Proposals
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
            <a
              href="https://discord.gg/realmsworld"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="gap-2">
                Join Discord
                <Users className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
