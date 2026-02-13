import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ChevronDown,
  Compass,
  ShieldCheck,
  Sparkles,
  Sword,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { games } from "@/data/games";

export function IntroSection() {
  return <IntroSectionContent />;
}

function IntroSectionContent() {
  const liveGameCount = games.filter((game) => game.isLive).length;
  const integratedStudioCount = new Set(games.map((game) => game.studio)).size;

  const rolloutSignals = [
    {
      icon: Sword,
      label: "Live Worlds",
      value: liveGameCount,
      detail: "Realms now traversable",
    },
    {
      icon: Sparkles,
      label: "Agent Status",
      value: "Traversing",
      detail: "Rolling out across games",
    },
    {
      icon: Compass,
      label: "Integrated Studios",
      value: integratedStudioCount,
      detail: "Worldbuilders now linked",
    },
  ];

  return (
    <section className="realm-section relative min-h-[100vh] overflow-hidden flex flex-col items-center justify-center">
      {/* Background glow orbs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[24%] h-[360px] w-[360px] rounded-full bg-primary/14 blur-3xl" />
        <div className="absolute right-[6%] top-[16%] h-[400px] w-[400px] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute left-[-6%] bottom-[-8%] h-[440px] w-[440px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Centered hero content */}
      <div className="container mx-auto px-4 py-24 sm:py-28 md:py-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Banner - first to appear */}
          <motion.p
            className="realm-banner mb-8"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            The Summoning Gate
          </motion.p>

          {/* Title line 1 */}
          <motion.h1
            className="realm-title text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.88] mb-2 hero-title-glow"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.9, ease: "easeOut" }}
          >
            One Agent.
          </motion.h1>

          {/* Title line 2 - shimmer */}
          <motion.span
            className="realm-title hero-title-shimmer text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.88] mb-8 block"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.9, ease: "easeOut" }}
          >
            Every Realm.
          </motion.span>

          {/* Subtitle */}
          <motion.p
            className="realm-subtitle text-base sm:text-lg md:text-xl max-w-2xl mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.7, ease: "easeOut" }}
          >
            A single autonomous champion crosses the Realms ecosystem, rolling
            out across games and adapting strategy to each world as the campaign
            expands.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6, ease: "easeOut" }}
          >
            <Button
              size="lg"
              variant="war"
              className="shadow-lg shadow-primary/20 text-base px-8"
              asChild
            >
              <Link to="/games">
                Enter the Realms <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="oath" className="text-base px-8" asChild>
              <a href="#agent-native">Track Live Rollout</a>
            </Button>
          </motion.div>

          {/* Sigils */}
          <motion.div
            className="flex flex-wrap justify-center gap-2.5 mb-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.9, duration: 0.6 }}
          >
            <span className="realm-sigil">Mythic Strategy Worlds</span>
            <span className="realm-sigil">Autonomous Champion</span>
            <span className="realm-sigil">Shared Agent Progression</span>
          </motion.div>

          {/* Campaign Pulse stats strip */}
          <motion.div
            className="w-full max-w-3xl realm-panel realm-edge-brackets rounded-2xl p-5 sm:p-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.1, duration: 0.7, ease: "easeOut" }}
          >
            <p className="realm-banner mb-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              Campaign Pulse
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {rolloutSignals.map((signal, index) => (
                <motion.div
                  key={signal.label}
                  className="card-parchment-dark realm-holo-card flex items-center gap-3 px-3.5 py-3"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 2.3 + index * 0.12,
                    duration: 0.45,
                    ease: "easeOut",
                  }}
                >
                  <signal.icon className="h-4.5 w-4.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="realm-sigil mb-1">{signal.label}</p>
                    <p className="text-sm text-foreground/80 leading-tight">
                      <span className="font-semibold text-foreground">
                        {signal.value}
                      </span>{" "}
                      {signal.detail}
                    </p>
                  </div>
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
          opacity: { delay: 2.8, duration: 0.6 },
          y: { delay: 2.8, duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <ChevronDown className="h-6 w-6 text-primary" />
      </motion.div>
    </section>
  );
}
