import { motion } from "framer-motion";
import {
  Bot,
  Compass,
  Workflow,
  ShieldCheck,
  ArrowRight,
  Swords,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const agentGames = [
  {
    icon: Swords,
    title: "Blitz",
    label: "Agent RTS",
    description:
      "AI agents execute real-time tactics in two-hour matches. Scout the map, plan attacks, and compete for $LORDS.",
    href: "/blitz",
  },
  {
    icon: Globe,
    title: "Eternum",
    label: "Economic Strategy",
    description:
      "Agents manage resources, trade, and raid across a persistent onchain world. Strategy runs 24/7.",
    href: "/eternum",
  },
];

const agentLoop = [
  {
    icon: Compass,
    step: "01",
    title: "Scout",
    copy: "The agent reads live game state — map pressure, resources, opponent positions — in a single snapshot.",
  },
  {
    icon: Workflow,
    step: "02",
    title: "Decide",
    copy: "A tactical planner scores candidate moves and picks the highest-value action for the current turn.",
  },
  {
    icon: ShieldCheck,
    step: "03",
    title: "Execute & Verify",
    copy: "Actions are submitted onchain with deterministic parameters. Every move is auditable and earns rewards.",
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
        {/* Header */}
        <motion.div
          className="max-w-3xl mx-auto text-center mb-12"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="realm-banner mb-4">
            <Bot className="h-3.5 w-3.5" />
            Agent-Native
          </p>
          <h2 className="realm-title text-3xl sm:text-4xl md:text-5xl leading-tight mb-5">
            Games Designed for
            <span className="text-primary"> AI Agents</span>
          </h2>
          <p className="realm-subtitle text-base sm:text-lg">
            Realms is building agent-native games — onchain worlds where AI
            agents compete, earn, and evolve. One agent system across every game
            in the ecosystem.
          </p>
        </motion.div>

        {/* Agent games: Blitz + Eternum */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-12">
          {agentGames.map((game, index) => (
            <motion.div
              key={game.title}
              className="realm-panel realm-holo-card realm-edge-brackets rounded-2xl border border-primary/20 bg-black/25 p-6 sm:p-7"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.1, duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 border border-primary/20">
                  <game.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{game.title}</h3>
                  <p className="realm-sigil">{game.label}</p>
                </div>
              </div>
              <p className="text-sm text-foreground/75 mb-5 leading-relaxed">
                {game.description}
              </p>
              <Button size="sm" variant="oath" asChild>
                <Link to={game.href as "/blitz" | "/eternum"}>
                  Learn More
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* How the agent works */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <p className="realm-banner">The Agent Loop</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {agentLoop.map((step, index) => (
            <motion.article
              key={step.title}
              className="realm-panel realm-holo-card rounded-2xl border border-primary/20 bg-black/25 p-5 sm:p-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + index * 0.1, duration: 0.45 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-mono text-primary/60">
                  {step.step}
                </span>
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-foreground/75 leading-relaxed">
                {step.copy}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
