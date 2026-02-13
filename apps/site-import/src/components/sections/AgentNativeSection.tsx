import { motion } from "framer-motion";
import {
  Bot,
  Compass,
  Workflow,
  ShieldCheck,
  Sparkles,
  ScrollText,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { games } from "@/data/games";

const pillars = [
  {
    icon: Compass,
    title: "Scout State",
    copy: "The agent inspects game conditions and identifies the strongest available line.",
  },
  {
    icon: Workflow,
    title: "Execute Turns",
    copy: "From tactical decisions to resource routing, actions are executed with consistent speed.",
  },
  {
    icon: ShieldCheck,
    title: "Adapt Meta",
    copy: "As games evolve, the playbook updates and ships ecosystem-wide without manual retraining.",
  },
];

const liveGameCount = games.filter((game) => game.isLive).length;
const integratedStudioCount = new Set(games.map((game) => game.studio)).size;

const rolloutSnapshot = [
  {
    icon: ScrollText,
    label: "Coverage",
    value: `${liveGameCount}/${games.length}`,
    helper: "Games integrated",
  },
  {
    icon: Users,
    label: "Studios",
    value: integratedStudioCount.toString(),
    helper: "Builder teams onboarded",
  },
  {
    icon: Sparkles,
    label: "Agent Status",
    value: "Rolling Out",
    helper: "Progressively live",
  },
];

export function AgentNativeSection() {
  return (
    <section className="realm-section relative py-20 sm:py-24 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute right-[-8%] top-1/2 -translate-y-1/2 h-52 w-52 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-12 items-start"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="realm-panel realm-edge-brackets realm-grid-scan rounded-2xl border border-primary/25 bg-black/30 backdrop-blur-md p-6 sm:p-8">
            <p className="realm-banner mb-4">
              Agent Native
            </p>
            <h2 className="realm-title text-3xl sm:text-4xl md:text-5xl leading-tight mb-5">
              One Agent.
              <span className="text-primary"> Shared Across Worlds.</span>
            </h2>
            <p className="realm-subtitle text-base sm:text-lg max-w-2xl mb-7">
              Realms is launching an autonomous player and deploying it across
              the ecosystem in phases. Start in one game, then carry the same
              strategic system into every connected world.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="war" asChild>
                <Link to="/games">
                  <Bot className="mr-2 h-4 w-4" />
                  Explore Ecosystem
                </Link>
              </Button>
              <Button size="lg" variant="oath" asChild>
                <a href="#ecosystem-atlas">View Live Atlas</a>
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <article className="realm-panel realm-edge-brackets realm-grid-scan rounded-2xl border border-primary/20 bg-black/25 p-5">
              <h3 className="realm-banner mb-4">
                Rollout Snapshot
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {rolloutSnapshot.map((metric) => (
                  <div
                    key={metric.label}
                    className="card-relic realm-holo-card rounded-xl border border-primary/15 bg-black/20 p-3"
                  >
                    <metric.icon className="h-4 w-4 text-primary mb-2" />
                    <p className="realm-sigil mb-1">
                      {metric.label}
                    </p>
                    <p className="text-lg font-semibold leading-tight">
                      {metric.value}
                    </p>
                    <p className="text-xs text-foreground/65 mt-1">
                      {metric.helper}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <div className="realm-journey-map rounded-2xl p-2">
              <div className="realm-journey-path" aria-hidden />
              <div className="space-y-4">
                {pillars.map((pillar, index) => (
                  <motion.article
                    key={pillar.title}
                    className="realm-world-node realm-panel realm-holo-card realm-edge-brackets rounded-2xl border border-primary/20 bg-black/25 p-5"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.1, duration: 0.45 }}
                  >
                    <pillar.icon className="h-5 w-5 text-primary mb-3" />
                    <h3 className="text-xl font-semibold mb-2">{pillar.title}</h3>
                    <p className="text-foreground/75">{pillar.copy}</p>
                  </motion.article>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
