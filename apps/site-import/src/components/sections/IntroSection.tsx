import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, ShieldCheck, Sparkles, Sword } from "lucide-react";
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
    <section className="realm-section relative min-h-[100vh] overflow-hidden flex items-center">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[24%] h-[360px] w-[360px] rounded-full bg-primary/14 blur-3xl" />
        <div className="absolute right-[6%] top-[16%] h-[400px] w-[400px] rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute left-[-6%] bottom-[-8%] h-[440px] w-[440px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-24 sm:py-28 md:py-32">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.div
            className="text-left"
            initial={{ opacity: 0, x: -36 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <p className="realm-banner mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              The Summoning Gate
            </p>
            <h1 className="realm-title text-4xl sm:text-5xl md:text-7xl leading-[0.92] mb-6 max-w-3xl">
              One Agent.
              <span className="block text-primary mt-1">Every Realm.</span>
            </h1>
            <p className="realm-subtitle text-base sm:text-lg md:text-xl max-w-2xl mb-10">
              A single autonomous champion now crosses the Realms ecosystem and is
              rolling out across games, adapting strategy to each world as the
              campaign expands.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Button
                size="lg"
                variant="war"
                className="shadow-lg shadow-primary/20"
                asChild
              >
                <Link to="/games">
                  Enter the Realms <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="oath" asChild>
                <a href="#agent-native">Track Live Rollout</a>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <span className="realm-sigil">Mythic Strategy Worlds</span>
              <span className="realm-sigil">Autonomous Champion</span>
              <span className="realm-sigil">Shared Agent Progression</span>
            </div>
          </motion.div>

          <motion.div
            className="hero-summoning-panel realm-panel realm-edge-brackets realm-grid-scan rounded-2xl p-5 sm:p-6"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.8, ease: "easeOut" }}
          >
            <div className="hero-ember-field" aria-hidden />
            <div className="hero-sigil-ring mx-auto mb-6">
              <div className="hero-sigil-core">
                <Sword className="h-6 w-6 text-primary" />
              </div>
            </div>

            <p className="realm-banner mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              Campaign Pulse
            </p>
            <p className="text-2xl sm:text-3xl font-semibold leading-tight mb-2">
              The Gate Is Open
            </p>
            <p className="text-sm sm:text-base text-foreground/75 mb-5">
              Agent routes are propagating realm to realm with synchronized
              playbooks and encounter-specific adaptation.
            </p>

            <div className="space-y-2.5">
              {rolloutSignals.map((signal, index) => (
                <motion.div
                  key={signal.label}
                  className="card-parchment-dark realm-holo-card flex items-center gap-3 px-3.5 py-3"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + index * 0.1, duration: 0.45, ease: "easeOut" }}
                >
                  <signal.icon className="h-4.5 w-4.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="realm-sigil mb-1">{signal.label}</p>
                    <p className="text-sm text-foreground/80 leading-tight">
                      <span className="font-semibold text-foreground">{signal.value}</span>{" "}
                      {signal.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
