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

export function TokenomicsSection() {
  // Fetch treasury balance
  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());

  // Fetch LORDS price and supply info
  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());

  // Calculate total LORDS in treasury
  const treasuryLords = treasuryBalance?.LORDS.amount || 0;
  const totalSupply = 300_000_000; // 300M total supply
  const treasuryPercentage = ((treasuryLords / totalSupply) * 100).toFixed(1);
  const marketPercentage = (100 - parseFloat(treasuryPercentage)).toFixed(1);

  const keyFeatures = [
    {
      icon: Coins,
      title: "100% Liquid Supply",
      description:
        "All 300M $LORDS tokens are fully liquid and tradeable - no locks, no vesting schedules",
    },
    {
      icon: Users,
      title: "DAO Treasury",
      description:
        "The DAO controls a portion of tokens for ecosystem development and community initiatives",
    },
    {
      icon: Briefcase,
      title: "Market Distribution",
      description:
        "The remaining tokens are freely traded on decentralized exchanges",
    },
    {
      icon: TrendingUp,
      title: "Value Accrual",
      description:
        "Staking rewards, game fees, and governance rights drive token utility",
    },
  ];

  return (
    <section className="container mx-auto px-4 py-16 sm:py-24">
      <motion.div
        className="w-full space-y-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <motion.div
          className="space-y-4 text-center max-w-3xl mx-auto"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold">$LORDS Tokenomics</h2>
          <p className="text-xl sm:text-2xl text-muted-foreground">
            A fully liquid token powering the Realms ecosystem
          </p>
        </motion.div>

        {/* Key Features Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          {keyFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.6 }}
            >
              <Card className="h-full backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <feature.icon className="w-10 h-10 mb-3 text-primary" />
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
        </motion.div>

        {/* Main Content Grid */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          {/* Left: Distribution Info */}
          <div className="space-y-6">
            <Card className="backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl">Token Distribution</CardTitle>
                <CardDescription className="text-lg">
                  Live on-chain data showing actual token distribution
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-primary/10">
                    <div>
                      <h4 className="font-semibold">DAO Treasury</h4>
                      <p className="text-sm text-muted-foreground">
                        {treasuryLords > 0
                          ? `${treasuryLords.toLocaleString()} LORDS`
                          : "Loading..."}
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-primary">
                      {treasuryLords > 0 ? `${treasuryPercentage}%` : "~40%"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-4 rounded-lg bg-secondary/50">
                    <div>
                      <h4 className="font-semibold">Market Liquid</h4>
                      <p className="text-sm text-muted-foreground">
                        {treasuryLords > 0
                          ? `${(
                              totalSupply - treasuryLords
                            ).toLocaleString()} LORDS`
                          : "Freely traded on DEXs"}
                      </p>
                    </div>
                    <span className="text-2xl font-bold">
                      {treasuryLords > 0 ? `${marketPercentage}%` : "~60%"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Total Supply:</strong> 300,000,000 $LORDS
                  </p>
                  {lordsInfo?.price?.rate && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Current Price:</strong> $
                      {parseFloat(lordsInfo.price.rate).toFixed(4)}
                    </p>
                  )}
                  {treasuryBalance && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Treasury Value:</strong> $
                      {treasuryBalance.LORDS.usdValue.toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Key Point:</strong> No token locks or vesting - all
                    tokens are immediately liquid and usable
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            <TokenomicsChart
              treasuryPercentage={
                treasuryLords > 0 ? parseFloat(treasuryPercentage) : 40
              }
              marketPercentage={
                treasuryLords > 0 ? parseFloat(marketPercentage) : 60
              }
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
