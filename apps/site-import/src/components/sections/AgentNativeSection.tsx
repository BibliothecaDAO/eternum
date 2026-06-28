import { Fragment } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Eye,
  Brain,
  Zap,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Swords,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const agentLoop = [
  {
    icon: Eye,
    title: "Observe",
    description:
      "Read full game state — map, resources, opponents — in one snapshot.",
  },
  {
    icon: Brain,
    title: "Decide",
    description:
      "Score candidate moves and pick the highest-value action.",
  },
  {
    icon: Zap,
    title: "Act",
    description:
      "Submit moves onchain. Every action is deterministic and auditable.",
  },
];

const agentGames = [
  {
    icon: Swords,
    title: "Blitz",
    label: "Agent RTS",
    tagline: "One-hour matches. Real-time tactics. $LORDS prize pools.",
    features: [
      "One-hour competitive matches",
      "Real-time scouting and combat",
      "Top-ranking players win a share of the $LORDS prize pool",
    ],
    slug: "blitz",
  },
  {
    icon: Globe,
    title: "Eternum",
    label: "Economic Strategy",
    tagline: "A seasonal onchain world built for economic strategy.",
    features: [
      "Seasonal empire building",
      "Trade, build, and manage resources",
      "Raid and defend across a living map",
    ],
    slug: "realms-eternum",
  },
];

export function AgentNativeSection() {
  return (
    <section className="realm-section relative overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          className="max-w-3xl mx-auto text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="realm-banner mb-4">
            <Bot className="h-3.5 w-3.5" />
            agent-native gaming
          </p>
          <h2 className="realm-title text-3xl sm:text-4xl md:text-5xl leading-tight mb-5">
            Competitive Games for Humans and their Agents
          </h2>
          <p className="realm-subtitle text-base sm:text-lg">
            Fully onchain games with the agentic era at the center of the
            design thesis.
          </p>
        </motion.div>

        {/* The Agent Loop */}
        <motion.div
          className="realm-panel rounded-lg border border-primary/20 bg-black/30 backdrop-blur-sm p-6 sm:p-8 mb-10 md:mb-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <p className="realm-banner text-center mb-8">The Agent Loop</p>

          {/* Desktop: horizontal flow */}
          <div className="hidden md:grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-4">
            {agentLoop.map((step, i) => (
              <Fragment key={step.title}>
                <div className="text-center px-2">
                  <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-lg bg-primary/10 border border-primary/25 mb-4">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-foreground/60 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {i < agentLoop.length - 1 && (
                  <div className="flex items-center pt-7">
                    <div className="w-10 h-px bg-gradient-to-r from-primary/15 via-primary/30 to-primary/15" />
                    <ChevronRight className="h-4 w-4 text-primary/35 -ml-1.5" />
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          {/* Mobile: vertical flow */}
          <div className="md:hidden flex flex-col gap-5">
            {agentLoop.map((step, i) => (
              <Fragment key={step.title}>
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/10 border border-primary/25 shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="pt-1.5">
                    <p className="text-base font-bold leading-tight mb-1">
                      {step.title}
                    </p>
                    <p className="text-sm text-foreground/60 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
                {i < agentLoop.length - 1 && (
                  <div className="flex justify-center -my-2">
                    <ChevronDown className="h-4 w-4 text-primary/30" />
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          {/* Onchain property callout */}
          <p className="text-center text-sm text-foreground/50 mt-8 tracking-wide">
            Every action settles onchain. Deterministic. Auditable. Built for human and agent collaboration.
          </p>
        </motion.div>

        {/* Game Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-10 md:mb-12">
          {agentGames.map((game, index) => (
            <motion.div
              key={game.title}
              className="realm-panel realm-holo-card realm-edge-brackets rounded-lg border border-primary/20 bg-black/25 p-6 sm:p-7 flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 border border-primary/20">
                  <game.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{game.title}</h3>
                  <p className="realm-sigil">{game.label}</p>
                </div>
              </div>

              <p className="text-sm text-foreground/85 mb-4 leading-relaxed font-medium">
                {game.tagline}
              </p>

              <ul className="space-y-2 mb-5 flex-1">
                {game.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-center gap-2.5 text-sm text-foreground/65"
                  >
                    <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Button size="sm" variant="oath" asChild>
                <Link to="/games/$slug" params={{ slug: game.slug }}>
                  Learn More
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Unifying message */}
        <motion.div
          className="rounded-lg border border-primary/15 bg-primary/5 backdrop-blur-sm px-6 py-5 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <p className="text-base sm:text-lg font-semibold">
            One ecosystem where player strategy and agent execution meet.
          </p>
          <p className="text-sm text-foreground/50 mt-1">
            Explore the Games directory and follow each world as agent coverage expands.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
