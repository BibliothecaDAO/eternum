import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Coins, Shield, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useVelords } from "@/hooks/use-velords";

export function IntroSection() {
  const { currentAPY, isAPYLoading, tvl, isTVLLoading, lordsLocked } =
    useVelords();

  const stats = [
    {
      icon: Shield,
      label: "Total Value Locked",
      value: tvl
        ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : isTVLLoading
        ? "Loading..."
        : "N/A",
      description: lordsLocked
        ? `${lordsLocked.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })} LORDS`
        : "In veLORDS",
    },
    {
      icon: Coins,
      label: "Current APY",
      value: currentAPY
        ? `${currentAPY.toFixed(2)}%`
        : isAPYLoading
        ? "Loading..."
        : "N/A",
      description: "Annual rewards",
    },
    {
      icon: Zap,
      label: "Active Games",
      value: "6",
      description: "In ecosystem",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-background/80 py-20 md:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          className="text-center max-w-4xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            terraforming onchain worlds
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            The premier onchain gaming ecosystem built on Starknet. Play games,
            earn rewards, and participate in the future of onchain gaming.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/games">
                Explore Games <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#learn-more">Learn More</a>
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="relative group"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg blur-xl group-hover:blur-2xl transition-all" />
              <div className="relative bg-card p-6 rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
                <stat.icon className="h-8 w-8 text-primary mb-4" />
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stat.description}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
