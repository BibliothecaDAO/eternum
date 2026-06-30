import { motion } from "framer-motion";
import {
  Bot,
  Eye,
  Brain,
  Zap,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  Swords,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const agentLoop = [
  {
    icon: Eye,
    title: "Observe",
    description: "Read the full game state in one snapshot.",
  },
  {
    icon: MessageSquare,
    title: "Report",
    description:
      "Send information, warnings, and strategic advice to a human player in real time.",
  },
  {
    icon: Brain,
    title: "Decide",
    description:
      "Score candidate moves and take action within strategic bounds.",
  },
  {
    icon: Zap,
    title: "Act",
    description:
      "Submit moves onchain. Every action is deterministic and auditable.",
  },
  {
    icon: RefreshCw,
    title: "Review",
    description:
      "Consider outcomes and learn from every victory and defeat.",
  },
];

const loopPositions = [
  "left-1/2 top-[2%] -translate-x-1/2",
  "left-[86%] top-[30%] -translate-x-1/2",
  "left-[72%] top-[78%] -translate-x-1/2",
  "left-[28%] top-[78%] -translate-x-1/2",
  "left-[14%] top-[30%] -translate-x-1/2",
];

const agentGames = [
  {
    icon: Swords,
    title: "Blitz",
    label: "Fast-paced Onchain Strategy",
    features: [
      "One-hour competitive matches, fast-paced gameplay.",
      "RTS-style development, movement and combat.",
      "Top-ranking players win a share of the $LORDS prize pool and build their MMR.",
    ],
    slug: "blitz",
  },
  {
    icon: Globe,
    title: "Eternum",
    label: "Seasonal Campaigns",
    features: [
      "Seasonal grand strategy games that unfold over several weeks.",
      "Join tribes, build religious followings, develop empires, and conquer the competition.",
      "Expansive economic gameplay with real stakes.",
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

          {/* Desktop: circular loop */}
          <div className="hidden md:block">
            <div className="relative mx-auto aspect-square max-w-[680px]">
              <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/25 bg-primary/[0.03] shadow-[inset_0_0_40px_rgba(246,194,122,0.08)]" />
              <div className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15 bg-black/35" />
              <RefreshCw className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-primary/55" aria-hidden="true" />

              {agentLoop.map((step, index) => (
                <div
                  key={step.title}
                  className={`absolute ${loopPositions[index]} w-44 rounded-lg border border-primary/20 bg-black/65 px-4 py-4 text-center backdrop-blur-md`}
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 text-base font-bold">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-foreground/65">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: compact loop cards */}
          <div className="grid gap-3 md:hidden">
            {agentLoop.map((step) => (
              <div key={step.title} className="flex items-start gap-4 rounded-lg border border-primary/15 bg-black/35 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="pt-1">
                  <p className="mb-1 text-base font-bold leading-tight">
                    {step.title}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/60">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Game Showcase */}
        <motion.div
          className="realm-panel rounded-lg border border-primary/20 bg-black/30 p-6 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <p className="realm-banner mx-auto mb-8 flex w-fit text-center">
            Flagship Agent-Native Games
          </p>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            {agentGames.map((game, index) => (
              <motion.div
                key={game.title}
                className="realm-panel realm-holo-card realm-edge-brackets flex flex-col rounded-lg border border-primary/20 bg-black/25 p-6 sm:p-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 + index * 0.1, duration: 0.5 }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <game.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{game.title}</h3>
                    <p className="realm-sigil">{game.label}</p>
                  </div>
                </div>

                <ul className="mb-5 flex-1 space-y-2.5">
                  {game.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/68"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
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
        </motion.div>
      </div>
    </section>
  );
}
