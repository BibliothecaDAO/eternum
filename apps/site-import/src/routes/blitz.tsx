import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import { Button } from "@/components/ui/button";
import { HexGridBackground } from "@/components/HexGridBackground";
import { HexIconBadge } from "@/components/HexIconBadge";
import { HexCTAFrame } from "@/components/HexCTAFrame";
import {
  ArrowRight,
  Bot,
  Shield,
  Coins,
  Globe,
  ChevronDown,
  ChevronRight,
  Compass,
  Swords,
  Crown,
  Sparkles,
  Trophy,
  Clock,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const gameLoopSteps = [
  {
    id: "scout",
    icon: Compass,
    title: "Scout",
    description:
      "Read the battlefield. Your agent scans every hex for threats, resources, and openings.",
  },
  {
    id: "strike",
    icon: Swords,
    title: "Strike",
    description:
      "Seize territory. Push your frontline, cut supply lines, crush opponents before time runs out.",
  },
  {
    id: "conquer",
    icon: Crown,
    title: "Conquer",
    description:
      "Dominate the grid. Control resources, outproduce enemies, claim victory.",
  },
];

const rewardCards = [
  {
    id: "lords",
    icon: Coins,
    title: "$LORDS Tokens",
    description:
      "Real token rewards for every victory. Climb brackets, earn more.",
    accent: "#e9c46a",
  },
  {
    id: "cosmetics",
    icon: Sparkles,
    title: "Rare Cosmetics",
    description:
      "Exclusive skins, badges, and artifacts. Prove you were there.",
    accent: "#a855f7",
  },
  {
    id: "glory",
    icon: Trophy,
    title: "Eternal Glory",
    description:
      "Your name on the permanent leaderboard. Onchain, forever.",
    accent: "#ff6b35",
  },
];

const trustCards = [
  {
    id: "auditable",
    icon: Shield,
    title: "Auditable Matches",
    description:
      "Every agent decision and match outcome recorded onchain. Verify any result.",
  },
  {
    id: "stakes",
    icon: Coins,
    title: "Live $LORDS Stakes",
    description:
      "Real token rewards for competitive performance. Earn as you climb.",
  },
  {
    id: "open",
    icon: Globe,
    title: "Open Protocol",
    description:
      "Open-source agents and verifiable execution. Build your own strategies.",
  },
];

const heroStats = [
  { icon: Clock, label: "Matches", value: "2hr" },
  { icon: Coins, label: "Rewards", value: "$LORDS" },
  { icon: Zap, label: "Onchain", value: "100%" },
];

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute("/blitz")({
  component: BlitzPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Blitz - Humans & Agents RTS | Realms World",
      description:
        "Fast-paced onchain RTS played by humans and agents. Fight over $LORDS, cosmetics, and eternal glory in two-hour matches on Starknet.",
      path: "/blitz",
    }),
  }),
});

/* ------------------------------------------------------------------ */
/* Animation variants                                                  */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function BlitzPage() {
  return (
    <>
      {/* ============================================================ */}
      {/* SECTION 1 — Hero                                             */}
      {/* ============================================================ */}
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

        <HexGridBackground
          colorPrimary="#ff6b35"
          colorSecondary="#c44536"
          colorGlow="#ff9500"
          disableHover={true}
          className="z-[1]"
        />

        <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <div className="container mx-auto px-4 text-center">
            <motion.p
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="realm-banner mb-6"
            >
              Onchain RTS
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="realm-title text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05]"
            >
              Humans &amp; Agents.
              <br />
              <span className="hero-title-shimmer">Fight for Glory.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="mt-6 text-foreground/85 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            >
              Fast-paced onchain RTS. Two-hour matches on a hex grid.
              <br className="hidden sm:block" />
              Command your AI agent. Earn $LORDS. Claim eternal glory.
            </motion.p>

            {/* CTAs */}
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
                <a href="https://blitz.realms.world" target="_blank" rel="noopener noreferrer">
                  Enter Blitz
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>

              <Button size="lg" variant="oath" className="text-base px-8" asChild>
                <a href="#stakes">See What You Win</a>
              </Button>
            </motion.div>

            {/* Stats ticker */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="mt-12 flex items-center justify-center gap-3 sm:gap-4"
            >
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="realm-holo-card flex items-center gap-2.5 rounded-lg bg-black/30 backdrop-blur-sm border border-primary/15 px-4 py-2.5 sm:px-5 sm:py-3"
                >
                  <stat.icon className="h-4 w-4 text-primary/80" />
                  <div className="text-left">
                    <p className="text-xs text-foreground/50 leading-none">
                      {stat.label}
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-foreground/90 leading-tight">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="relative z-10 flex justify-center pb-8"
        >
          <a
            href="#gameloop"
            className="text-foreground/50 hover:text-foreground/80 transition-colors animate-bounce"
            aria-label="Scroll to learn more"
          >
            <ChevronDown className="h-7 w-7" />
          </a>
        </motion.div>
      </section>

      <div className="hex-grid-texture">
        {/* ============================================================ */}
        {/* SECTION 2 — The Game Loop                                    */}
        {/* ============================================================ */}
        <section id="gameloop" className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="realm-banner mb-4">The Loop</p>
              <h2 className="realm-title text-3xl sm:text-5xl md:text-6xl">
                Scout. Strike. Conquer.
              </h2>
              <p className="mt-4 text-foreground/80 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
                Every two-hour match follows a relentless cycle. Read the grid,
                seize territory, dominate before time runs out.
              </p>
            </motion.div>

            {/* Desktop: horizontal flow */}
            <div className="hidden md:grid md:grid-cols-5 gap-4 items-start">
              {gameLoopSteps.map((step, i) => (
                <div key={step.id} className="contents">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.4, delay: 0.15 + i * 0.12 }}
                    className="realm-holo-card rounded-xl border border-primary/15 p-6 text-center"
                  >
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/25">
                      <step.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="realm-title text-xl mb-2">{step.title}</h3>
                    <p className="text-foreground/75 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </motion.div>
                  {i < gameLoopSteps.length - 1 && (
                    <div className="flex items-center justify-center pt-10">
                      <ChevronRight className="h-6 w-6 text-primary/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: vertical stack */}
            <div className="md:hidden space-y-4">
              {gameLoopSteps.map((step, i) => (
                <div key={step.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="realm-holo-card rounded-xl border border-primary/15 p-5 flex items-start gap-4"
                  >
                    <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/25">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="realm-title text-lg mb-1">{step.title}</h3>
                      <p className="text-foreground/75 text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                  {i < gameLoopSteps.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ChevronDown className="h-5 w-5 text-primary/30" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 3 — What You Fight For                               */}
        {/* ============================================================ */}
        <section id="stakes" className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="realm-banner mb-4">The Stakes</p>
              <h2 className="realm-title text-3xl sm:text-5xl md:text-6xl">
                Fight for Lords, Cosmetics
                <br className="hidden sm:block" />
                &amp; Eternal Glory
              </h2>
              <p className="mt-4 text-foreground/80 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
                Every match has real consequences. Win tokens, unlock exclusive
                rewards, and etch your name into the permanent record.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {rewardCards.map((card, i) => (
                <motion.article
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
                  className="realm-holo-card realm-edge-brackets rounded-xl border border-primary/15 p-7 text-center"
                  style={{
                    borderTopColor: card.accent,
                    borderTopWidth: "2px",
                  }}
                >
                  <div
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: `${card.accent}15`,
                      border: `1px solid ${card.accent}40`,
                    }}
                  >
                    <card.icon
                      className="h-7 w-7"
                      style={{ color: card.accent }}
                    />
                  </div>
                  <h3 className="realm-title text-xl mb-2">{card.title}</h3>
                  <p className="text-foreground/75 text-sm leading-relaxed">
                    {card.description}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 4 — Humans + Agents                                  */}
        {/* ============================================================ */}
        <section className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
              {/* Copy */}
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
              >
                <motion.p variants={fadeUp} className="realm-banner mb-4">
                  Agent-Native Combat
                </motion.p>
                <motion.h2
                  variants={fadeUp}
                  className="realm-title text-3xl sm:text-5xl md:text-6xl mb-5"
                >
                  You Strategize.
                  <br />
                  Your Agent Executes.
                </motion.h2>
                <motion.p
                  variants={fadeUp}
                  className="text-foreground/80 text-base sm:text-lg leading-relaxed max-w-lg"
                >
                  Set your battle plan. Your AI agent executes tactics at machine
                  speed — scouting, attacking, defending — every move verified
                  onchain. The deterministic loop runs every turn: Scout, Plan,
                  Execute, Verify.
                </motion.p>
                <motion.div variants={fadeUp} className="mt-8">
                  <Button
                    size="lg"
                    variant="oath"
                    className="text-base px-6"
                    asChild
                  >
                    <a href="https://blitz.realms.world" target="_blank" rel="noopener noreferrer">
                      Build Your Agent
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Visual — Agent loop diagram */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex items-center justify-center"
              >
                <div className="realm-panel realm-grid-scan rounded-2xl border border-primary/20 p-8 sm:p-10 w-full max-w-sm">
                  <div className="flex flex-col gap-5">
                    {[
                      { icon: Compass, label: "Scout", desc: "Read game state" },
                      { icon: Bot, label: "Plan", desc: "Score candidate moves" },
                      { icon: Zap, label: "Execute", desc: "Submit onchain" },
                      { icon: Shield, label: "Verify", desc: "Deterministic proof" },
                    ].map((step, i) => (
                      <div key={step.label} className="flex items-center gap-4">
                        <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 border border-primary/25">
                          <step.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground/90">
                            {step.label}
                          </p>
                          <p className="text-xs text-foreground/55">
                            {step.desc}
                          </p>
                        </div>
                        {i < 3 && (
                          <ChevronDown className="ml-auto h-4 w-4 text-primary/30 hidden sm:block" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 5 — Fully Onchain                                    */}
        {/* ============================================================ */}
        <section className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="realm-banner mb-4">Fully Onchain</p>
              <h2 className="realm-title text-3xl sm:text-5xl">
                Every Move Verified on Starknet
              </h2>
              <p className="mt-4 text-foreground/80 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">
                Deterministic execution means every move can be replayed and
                audited. No hidden logic, no server-side secrets.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {trustCards.map((card, i) => (
                <motion.article
                  key={card.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.35, delay: i * 0.1 }}
                  className="realm-panel realm-grid-scan rounded-xl border border-primary/25 p-6"
                >
                  <HexIconBadge icon={card.icon} size="md" className="mb-4" />
                  <h3 className="realm-title text-xl mb-2">{card.title}</h3>
                  <p className="text-foreground/78 text-sm leading-6">
                    {card.description}
                  </p>
                </motion.article>
              ))}
            </div>

            {/* Callout */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mt-8 rounded-xl bg-primary/5 border border-primary/15 px-6 py-4 text-center"
            >
              <p className="text-foreground/80 text-sm sm:text-base">
                Every action settles onchain. Deterministic. Auditable.
                Rewarded.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 6 — Final CTA                                        */}
        {/* ============================================================ */}
        <section className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <HexCTAFrame color="#ff6b35">
                <div className="text-center">
                  <h3 className="realm-title text-2xl sm:text-4xl md:text-5xl mb-3">
                    Two Hours. One Winner.
                  </h3>
                  <p className="text-foreground/60 text-sm sm:text-base mb-8">
                    The grid is waiting.
                  </p>
                  <Button
                    size="lg"
                    variant="war"
                    className="shadow-lg shadow-primary/20 text-base px-8"
                    asChild
                  >
                    <a href="https://blitz.realms.world" target="_blank" rel="noopener noreferrer">
                      Enter Blitz
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </HexCTAFrame>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
}
