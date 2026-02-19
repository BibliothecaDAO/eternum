import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  Coins,
  Gamepad2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { games } from "@/data/games";
import { useQuery } from "@tanstack/react-query";
import {
  lordsInfoQueryOptions,
  treasuryBalanceQueryOptions,
} from "@/lib/query-options";

const HeroApyValue = lazy(() =>
  import("@/components/sections/HeroApyValue").then((module) => ({
    default: module.HeroApyValue,
  }))
);

const RealmSceneBackground = lazy(() =>
  import("@/components/RealmSceneBackground").then((module) => ({
    default: module.RealmSceneBackground,
  }))
);

export function IntroSection() {
  return <IntroSectionContent />;
}

function IntroSectionContent() {
  const liveGameCount = games.filter((game) => game.isLive).length;

  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());
  const { data: treasuryBalance } = useQuery(treasuryBalanceQueryOptions());

  const lordsPrice = lordsInfo?.price?.rate
    ? `$${parseFloat(lordsInfo.price.rate).toFixed(4)}`
    : null;

  const totalTreasury = treasuryBalance
    ? (treasuryBalance.LORDS.usdValue ?? 0) +
      (treasuryBalance.ETH.usdValue ?? 0) +
      (treasuryBalance.WETH.usdValue ?? 0) +
      (treasuryBalance.USDC.usdValue ?? 0)
    : null;

  const tickerStats = [
    {
      icon: Gamepad2,
      label: "Agent-Native Games",
      value: liveGameCount.toString(),
    },
    {
      icon: Coins,
      label: "LORDS Price",
      value: lordsPrice,
    },
    {
      icon: TrendingUp,
      label: "Staking APY",
      value: null as string | null,
    },
    {
      icon: Wallet,
      label: "Treasury",
      value: totalTreasury
        ? `$${(totalTreasury / 1_000_000).toFixed(2)}M`
        : null,
    },
  ];

  return (
    <section className="realm-section relative min-h-[100vh] overflow-hidden flex flex-col items-center justify-center">
      {/* Agent consciousness background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Suspense fallback={null}>
          <RealmSceneBackground />
        </Suspense>
      </div>

      {/* Centered hero content */}
      <div className="container mx-auto px-4 py-24 sm:py-28 md:py-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Banner */}
          <motion.p
            className="realm-banner mb-8"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            <Bot className="h-3.5 w-3.5" />
            Agent-Native Gaming
          </motion.p>

          {/* Title line 1 */}
          <motion.h1
            className="realm-title text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.88] mb-2 hero-title-glow"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9, ease: "easeOut" }}
          >
            Agents Play.
          </motion.h1>

          {/* Title line 2 - shimmer */}
          <motion.span
            className="realm-title hero-title-shimmer text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.88] mb-8 block"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.9, ease: "easeOut" }}
          >
            You Earn.
          </motion.span>

          {/* Subtitle */}
          <motion.p
            className="realm-subtitle text-base sm:text-lg md:text-xl max-w-2xl mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.7, ease: "easeOut" }}
          >
            AI agents compete across onchain strategy games in the Realms
            ecosystem. Every move is verified. Every win earns $LORDS.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6, ease: "easeOut" }}
          >
            <Button
              size="lg"
              variant="war"
              className="shadow-lg shadow-primary/20 text-base px-8"
              asChild
            >
              <Link to="/blitz">
                Play Blitz <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="oath" className="text-base px-8" asChild>
              <a href="#games">Explore Games</a>
            </Button>
          </motion.div>

          {/* Ecosystem Ticker */}
          <motion.div
            className="w-full max-w-3xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.7, ease: "easeOut" }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tickerStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className="realm-panel realm-holo-card flex flex-col items-center gap-1.5 rounded-xl border border-primary/20 bg-black/30 backdrop-blur-sm px-3 py-3"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 1.9 + index * 0.1,
                    duration: 0.45,
                    ease: "easeOut",
                  }}
                >
                  <stat.icon className="h-4 w-4 text-primary" />
                  <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                    {stat.label}
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {stat.label === "Staking APY" ? (
                      <Suspense
                        fallback={
                          <span className="text-foreground/40">&mdash;</span>
                        }
                      >
                        <HeroApyValue />
                      </Suspense>
                    ) : (
                      stat.value ?? (
                        <span className="text-foreground/40">&mdash;</span>
                      )
                    )}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5, y: [0, 8, 0] }}
        transition={{
          opacity: { delay: 2.5, duration: 0.6 },
          y: { delay: 2.5, duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <ChevronDown className="h-6 w-6 text-primary" />
      </motion.div>
    </section>
  );
}
