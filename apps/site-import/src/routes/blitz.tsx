import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bot,
  Shield,
  Coins,
  Globe,
  ChevronDown,
  ImageIcon,
} from "lucide-react";

const blitzPhases = [
  {
    id: "ingest",
    title: "State Ingest",
    detail:
      "Blitz pulls live combat state, roster conditions, and objective pressure in one snapshot.",
  },
  {
    id: "decide",
    title: "Tactical Decide",
    detail:
      "The planner agent scores candidate lines and chooses the action with best expected tempo.",
  },
  {
    id: "execute",
    title: "Execution",
    detail:
      "Action packets are issued with deterministic parameters so matches remain auditable.",
  },
  {
    id: "checkpoint",
    title: "Checkpoint",
    detail:
      "Results are published as structured events for replay, reward routing, and ecosystem sync.",
  },
];

const agentRoles = [
  {
    id: "scout",
    role: "Scout Agent",
    summary:
      "Detects map pressure, cooldown windows, and opponent posture before each decision turn.",
  },
  {
    id: "planner",
    role: "Planner Agent",
    summary:
      "Builds short tactical trees and picks the highest-value route based on current win conditions.",
  },
  {
    id: "executor",
    role: "Executor Agent",
    summary:
      "Converts strategy into concrete commands with strict guardrails and deterministic ordering.",
  },
  {
    id: "verifier",
    role: "Verifier Agent",
    summary:
      "Validates outcomes, signs checkpoints, and emits machine-readable state for downstream consumers.",
  },
];

const trustCards = [
  {
    id: "auditable",
    icon: Shield,
    title: "Auditable Matches",
    description:
      "Every agent decision and match outcome is recorded onchain. Verify any result.",
  },
  {
    id: "stakes",
    icon: Coins,
    title: "Live $LORDS Stakes",
    description:
      "Real token rewards for competitive performance. Earn as you climb the brackets.",
  },
  {
    id: "open",
    icon: Globe,
    title: "Open Protocol",
    description:
      "Open-source agents and verifiable execution. Build your own strategies on top.",
  },
];

const screenshotPlaceholders = [
  { id: "ss-1", label: "Match overview" },
  { id: "ss-2", label: "Agent decision tree" },
  { id: "ss-3", label: "Live combat feed" },
  { id: "ss-4", label: "Post-match audit" },
];

export const Route = createFileRoute("/blitz")({
  component: BlitzPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Blitz - Agent RTS Combat | Realms World",
      description:
        "Two-hour RTS matches with AI agents executing your tactics. Every move verified onchain on Starknet.",
      path: "/blitz",
    }),
  }),
});

function BlitzPage() {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Section 1 - Full-bleed Hero                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-[100svh] overflow-hidden flex flex-col">
        {/* Video background */}
        <video
          className="absolute inset-0 h-full w-full object-cover mix-blend-screen opacity-70 saturate-150 contrast-110 scale-[1.03]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/og.jpg"
        >
          <source src="/videos/blitz-stub.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

        {/* Centered content */}
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="container mx-auto px-4 text-center">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="realm-banner mb-6"
            >
              Agent RTS
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="realm-title text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05]"
            >
              Two Hours. One Winner.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="mt-6 text-foreground/85 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            >
              A fast-paced onchain RTS where AI agents execute your tactics in
              real-time. Every decision is verified. Every match is auditable.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
            >
              <Button
                size="lg"
                variant="war"
                className="shadow-lg shadow-primary/20 text-base px-8"
                asChild
              >
                <Link to="/games">
                  Enter Blitz
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button size="lg" variant="oath" className="text-base px-8" asChild>
                <a href="#agent-loop">See The Loop</a>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Bouncing scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="relative z-10 flex justify-center pb-8"
        >
          <a
            href="#agent-loop"
            className="text-foreground/50 hover:text-foreground/80 transition-colors animate-bounce"
            aria-label="Scroll to learn more"
          >
            <ChevronDown className="h-7 w-7" />
          </a>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 - Agent-First Gameplay                                   */}
      {/* ------------------------------------------------------------------ */}
      <section id="agent-loop" className="relative py-20 sm:py-28">
        <div className="container mx-auto px-4">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="realm-banner mb-4">The Agent Loop</p>
            <h2 className="realm-title text-3xl sm:text-5xl">
              Agents Run Your Tactics
            </h2>
            <p className="mt-4 text-foreground/80 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">
              Every Blitz turn follows a deterministic four-phase cycle. Your
              agents ingest state, decide tactics, execute commands, and
              checkpoint results.
            </p>
          </motion.div>

          {/* Phase cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {blitzPhases.map((phase, index) => (
              <motion.article
                key={phase.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.1 }}
                className="card-relic realm-holo-card"
              >
                <p className="realm-sigil mb-3">
                  Phase {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="realm-title text-xl">{phase.title}</h3>
                <p className="mt-2 text-foreground/78 text-sm leading-6">
                  {phase.detail}
                </p>
              </motion.article>
            ))}
          </div>

          {/* Agent Roles sub-section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mt-20 mb-10"
          >
            <p className="realm-banner mb-4">Agent Roles</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agentRoles.map((agent, index) => (
              <motion.article
                key={agent.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.1 }}
                className="card-relic"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Bot className="h-5 w-5 text-primary/80" />
                  <h3 className="realm-title text-lg">{agent.role}</h3>
                </div>
                <p className="text-foreground/78 text-sm leading-6">
                  {agent.summary}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 - Fully Onchain & Secure                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative py-20 sm:py-28">
        <div className="container mx-auto px-4">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="realm-banner mb-4">Fully Onchain</p>
            <h2 className="realm-title text-3xl sm:text-5xl">
              Every Match Verified on Starknet
            </h2>
            <p className="mt-4 text-foreground/80 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">
              Deterministic execution means every move can be replayed and
              audited. No hidden logic, no server-side secrets.
            </p>
          </motion.div>

          {/* Trust cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trustCards.map((card, index) => (
              <motion.article
                key={card.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.1 }}
                className="realm-panel realm-grid-scan rounded-xl border border-primary/25 p-6"
              >
                <card.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="realm-title text-xl mb-2">{card.title}</h3>
                <p className="text-foreground/78 text-sm leading-6">
                  {card.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4 - Screenshot Gallery (placeholder)                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative py-20 sm:py-28">
        <div className="container mx-auto px-4">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="realm-banner mb-4">See It In Action</p>
            <h2 className="realm-title text-3xl sm:text-5xl">
              The Arena Awaits
            </h2>
          </motion.div>

          {/* Placeholder screenshot grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {screenshotPlaceholders.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className="aspect-video rounded-xl border border-dashed border-primary/30 bg-black/30 flex flex-col items-center justify-center gap-3"
              >
                <ImageIcon className="h-8 w-8 text-foreground/25" />
                <span className="text-foreground/35 text-sm">
                  Screenshot coming soon
                </span>
              </motion.div>
            ))}
          </div>

          {/* Final CTA banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="mt-16 text-center"
          >
            <h3 className="realm-title text-2xl sm:text-4xl mb-6">
              Ready to Compete?
            </h3>
            <Button
              size="lg"
              variant="war"
              className="shadow-lg shadow-primary/20 text-base px-8"
              asChild
            >
              <Link to="/games">
                Enter Blitz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </>
  );
}
