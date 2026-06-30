import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Castle,
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

  const parsedLordsPrice = Number.parseFloat(lordsInfo?.price?.rate ?? "");
  const lordsPrice = Number.isFinite(parsedLordsPrice)
    ? `$${parsedLordsPrice.toFixed(4)}`
    : null;

  const totalTreasury = treasuryBalance
    ? Object.values(treasuryBalance).reduce(
        (sum, asset) => sum + (asset.usdValue ?? 0),
        0,
      )
    : null;

  const tickerStats = [
    {
      icon: Gamepad2,
      label: "Onchain Games",
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
        <img
          src="/brand/castle.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-45 saturate-[0.9]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,12,0.38),rgba(9,9,12,0.78)),radial-gradient(circle_at_50%_42%,rgba(246,194,122,0.12),transparent_46%)]" />
        <Suspense fallback={null}>
          <RealmSceneBackground />
        </Suspense>
      </div>

      {/* Centered hero content */}
      <div className="container mx-auto px-4 py-24 sm:py-28 md:py-32">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          {/* Banner */}
          <motion.p
            className="realm-banner mb-8"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            <Castle className="h-3.5 w-3.5" />
            WELCOME TO THE REALMS
          </motion.p>

          {/* Title */}
          <motion.h1
            className="realm-title hero-title-shimmer text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.9] mb-8"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9, ease: "easeOut" }}
          >
            The New Frontier of Gaming
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="realm-subtitle text-base sm:text-lg md:text-xl max-w-3xl mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.7, ease: "easeOut" }}
          >
            The AI era is here and fundamentally changing gaming as we know it.
            The Realms Ecosystem is building for the new age, one where AI and
            humans can build, strategize, collaborate, and compete. Together.
            Onchain. Forever.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.6, ease: "easeOut" }}
          >
            <Button size="lg" variant="oath" className="w-full justify-center text-base px-6" asChild>
              <a href="https://market.realms.world/" target="_blank" rel="noopener noreferrer">
                Browse Marketplace
              </a>
            </Button>
            <Button
              size="lg"
              variant="war"
              className="w-full justify-center shadow-lg shadow-primary/20 text-base px-6"
              asChild
            >
              <Link to="/games">Explore Games</Link>
            </Button>
            <Button size="lg" variant="oath" className="w-full justify-center text-base px-6" asChild>
              <a href="https://account.realms.world/velords" target="_blank" rel="noopener noreferrer">
                Stake veLORDS
              </a>
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
                  className="realm-panel realm-holo-card flex flex-col items-center gap-1.5 rounded-lg border border-primary/20 bg-black/30 backdrop-blur-sm px-3 py-3"
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
