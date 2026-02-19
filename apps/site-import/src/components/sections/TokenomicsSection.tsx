import { motion } from "framer-motion";
import { TokenomicsChart } from "@/components/TokenomicsChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Coins, Users, Briefcase, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  lordsInfoQueryOptions,
  treasuryBalanceQueryOptions,
} from "@/lib/query-options";
import { LORDS_TOTAL_SUPPLY } from "@/lib/constants";

export function TokenomicsSection() {
  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());
  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());

  const treasuryLords = treasuryBalance?.LORDS.amount || 0;
  const treasuryPercentage = ((treasuryLords / LORDS_TOTAL_SUPPLY) * 100).toFixed(1);
  const marketPercentage = (100 - parseFloat(treasuryPercentage)).toFixed(1);

  const supplySnapshot = [
    {
      label: "Total Supply",
      value: LORDS_TOTAL_SUPPLY.toLocaleString(),
      helper: "$LORDS",
    },
    {
      label: "Treasury Share",
      value: treasuryLords > 0 ? `${treasuryPercentage}%` : "~40%",
      helper: treasuryLords > 0 ? "Onchain" : "Estimated",
    },
    {
      label: "Market Share",
      value: treasuryLords > 0 ? `${marketPercentage}%` : "~60%",
      helper: "Freely liquid",
    },
    {
      label: "Current Price",
      value: lordsInfo?.price?.rate
        ? `$${parseFloat(lordsInfo.price.rate).toFixed(4)}`
        : "Syncing...",
      helper: "Spot reference",
    },
  ];

  const utilityPillars = [
    {
      icon: Coins,
      title: "Liquid by Design",
      description:
        "All 300M tokens are liquid with no vesting walls or unlock cliffs.",
    },
    {
      icon: Users,
      title: "Governance Weight",
      description:
        "Token holders shape treasury allocation and ecosystem direction.",
    },
    {
      icon: Briefcase,
      title: "Ecosystem Utility",
      description:
        "Fees, staking, and game economies continuously reinforce token demand.",
    },
    {
      icon: TrendingUp,
      title: "Value Capture",
      description:
        "Revenue loops from onchain activity into veLORDS participation.",
    },
  ];

  return (
    <section className="realm-section container mx-auto px-4 py-16 sm:py-24">
      <motion.div
        className="w-full space-y-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="space-y-4 text-center max-w-3xl mx-auto"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          <p className="realm-banner">
            Token System
          </p>
          <h2 className="realm-title text-4xl sm:text-5xl font-bold">
            $LORDS Tokenomics
          </h2>
          <p className="realm-subtitle text-base sm:text-lg">
            A liquid token model designed for gameplay economies, governance,
            and long-term ecosystem alignment.
          </p>
        </motion.div>

        <motion.div
          className="realm-panel rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-5 sm:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <h3 className="realm-banner mb-4">
            Supply Snapshot
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {supplySnapshot.map((item) => (
              <div key={item.label} className="card-relic rounded-xl border border-primary/15 p-4">
                <p className="realm-sigil mb-2">
                  {item.label}
                </p>
                <p className="text-lg sm:text-xl font-semibold mb-1">{item.value}</p>
                <p className="text-xs text-foreground/60">{item.helper}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <Card className="card-parchment-dark backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="text-2xl">Distribution Profile</CardTitle>
              <CardDescription className="text-base">
                Live treasury-held vs market-liquid supply split.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="card-relic flex justify-between items-center p-4 rounded-lg bg-primary/10">
                  <div>
                    <h4 className="font-semibold">DAO Treasury</h4>
                    <p className="text-sm text-muted-foreground">
                      {treasuryLords > 0
                        ? `${treasuryLords.toLocaleString()} LORDS`
                        : "Syncing..."}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    {treasuryLords > 0 ? `${treasuryPercentage}%` : "~40%"}
                  </span>
                </div>

                <div className="card-relic flex justify-between items-center p-4 rounded-lg bg-secondary/50">
                  <div>
                    <h4 className="font-semibold">Market Liquid</h4>
                    <p className="text-sm text-muted-foreground">
                      {treasuryLords > 0
                        ? `${(
                            LORDS_TOTAL_SUPPLY - treasuryLords
                          ).toLocaleString()} LORDS`
                        : "Syncing..."}
                    </p>
                  </div>
                  <span className="text-2xl font-bold">
                    {treasuryLords > 0 ? `${marketPercentage}%` : "~60%"}
                  </span>
                </div>
              </div>

              <TokenomicsChart
                treasuryPercentage={
                  treasuryLords > 0 ? parseFloat(treasuryPercentage) : 40
                }
                marketPercentage={
                  treasuryLords > 0 ? parseFloat(marketPercentage) : 60
                }
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {utilityPillars.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + index * 0.08, duration: 0.5 }}
              >
                <Card className="card-relic h-full backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <feature.icon className="w-8 h-8 mb-2 text-primary" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
