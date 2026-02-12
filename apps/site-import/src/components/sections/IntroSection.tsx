import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Coins, Sparkles, Sword, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useVelords } from "@/hooks/use-velords";
import { StarknetProvider } from "@/hooks/starknet-provider";
import { games } from "@/data/games";

export function IntroSection() {
  return (
    <StarknetProvider>
      <IntroSectionContent />
    </StarknetProvider>
  );
}

function IntroSectionContent() {
  const { currentAPY, isAPYLoading, tvl, isTVLLoading } = useVelords();
  const liveGameCount = games.filter((game) => game.isLive).length;

  const heroStats = [
    {
      icon: Sword,
      label: "Live Game Count",
      value: liveGameCount.toString(),
      detail: "Realms currently playable",
    },
    {
      icon: Sparkles,
      label: "Agent Rollout",
      value: "Active",
      detail: "Rolling out across games",
    },
    {
      icon: Coins,
      label: "Ecosystem TVL",
      value: tvl
        ? `$${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : isTVLLoading
        ? "Syncing..."
        : "N/A",
      detail: "Locked via veLORDS",
    },
    {
      icon: Zap,
      label: "Current APY",
      value: currentAPY
        ? `${currentAPY.toFixed(2)}%`
        : isAPYLoading
        ? "Syncing..."
        : "N/A",
      detail: "Annual rewards",
    },
  ];

  return (
    <section className="relative overflow-hidden py-18 sm:py-24 md:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-12 -translate-x-1/2 h-[360px] w-[95%] max-w-6xl rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute left-1/2 top-16 -translate-x-1/2 h-[520px] w-[92%] max-w-6xl border border-primary/30 rounded-[999px] opacity-55" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          className="max-w-5xl mx-auto text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <p className="inline-flex items-center gap-2 text-xs tracking-[0.28em] uppercase text-primary/90 mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Agent Native Games
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl leading-[0.95] tracking-tight text-foreground mb-6">
            Mythic Worlds.
            <span className="block text-primary">One Autonomous Champion.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-foreground/85 max-w-3xl mx-auto mb-10">
            The Realms ecosystem is now agent-native. Our autonomous player is
            rolling out across games so you can explore every realm with deeper
            strategy and faster execution.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <Button size="lg" className="shadow-lg shadow-primary/20" asChild>
              <Link to="/games">
                Explore Ecosystem <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#agent-native">See Agent Rollout</a>
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
        >
          {heroStats.map((stat, index) => (
            <motion.article
              key={stat.label}
              className="rounded-2xl border border-primary/20 bg-black/25 backdrop-blur-md p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + index * 0.1, duration: 0.45 }}
            >
              <stat.icon className="h-5 w-5 text-primary mb-4" />
              <p className="text-3xl font-bold text-foreground mb-1">{stat.value}</p>
              <p className="text-xs uppercase tracking-[0.14em] text-primary/90 mb-2">
                {stat.label}
              </p>
              <p className="text-sm text-foreground/70">{stat.detail}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
