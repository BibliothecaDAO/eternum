import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import { Button } from "@/components/ui/button";
import { HexGridBackground } from "@/components/HexGridBackground";
import { HexIconBadge } from "@/components/HexIconBadge";
import { HexCTAFrame } from "@/components/HexCTAFrame";
import {
  ArrowRight,
  Shield,
  Coins,
  Globe,
  Swords,
  ChevronDown,
  ChevronRight,
  Bot,
  Pickaxe,
  Flag,
  Handshake,
  Flame,
} from "lucide-react";

export const Route = createFileRoute("/eternum")({
  component: EternumPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Eternum - Seasonal Onchain MMO | Realms World",
      description:
        "A seasonal onchain MMO played over 4–8 weeks on an infinite hex map. Command AI agents, forge alliances, and conquer for real $LORDS on Starknet.",
      path: "/eternum",
    }),
  }),
});

const seasonPhases = [
  {
    icon: Flag,
    weeks: "Week 1–2",
    title: "Land Rush",
    description:
      "Claim territory, secure resource nodes, and scout the infinite map before your rivals do.",
  },
  {
    icon: Handshake,
    weeks: "Week 3–5",
    title: "Empire Building",
    description:
      "Forge alliances, build infrastructure, and establish trade routes. Diplomacy is power.",
  },
  {
    icon: Flame,
    weeks: "Week 6–8",
    title: "Total War",
    description:
      "Alliances shatter. Empires clash. The strongest take $LORDS — the rest are conquered.",
  },
];

const pillars = [
  {
    icon: Bot,
    title: "Command Your Agents",
    description:
      "Deploy AI agents that play 24/7 on your behalf — even while you sleep.",
    features: [
      "Agents execute your strategy around the clock",
      "Set high-level directives, agents handle tactics",
      "Every action settles onchain",
    ],
  },
  {
    icon: Pickaxe,
    title: "Build & Trade",
    description:
      "Every hex generates resources. Grow your economy and forge trade networks.",
    features: [
      "Claim hexes across an infinite map",
      "Construct buildings and fortifications",
      "Trade resources with allies and markets",
    ],
  },
  {
    icon: Swords,
    title: "Conquer & Earn",
    description:
      "Raid enemies, break alliances, fight wars. The strongest empires earn real $LORDS.",
    features: [
      "Raid enemy territory for resources",
      "Wage wars across the hex grid",
      "Win $LORDS every season",
    ],
  },
];

const trustFeatures = [
  {
    icon: Shield,
    title: "100% Onchain",
    description:
      "All game state lives on Starknet. Your assets, progress, and territory are truly yours.",
  },
  {
    icon: Coins,
    title: "Live $LORDS Economy",
    description:
      "Real token economics powering in-game trade, seasonal rewards, and governance.",
  },
  {
    icon: Globe,
    title: "Open Source",
    description:
      "Fully auditable codebase. Verify the rules, inspect the logic, trust the game.",
  },
];

const screenshots = [
  {
    src: "/games/realms-eternum/screenshots/1.png",
    alt: "Eternum gameplay — strategic overview of hex territories",
  },
  {
    src: "/games/realms-eternum/screenshots/2.png",
    alt: "Eternum gameplay — battle across the hex grid",
  },
  {
    src: "/games/realms-eternum/screenshots/3.png",
    alt: "Eternum gameplay — the infinite world map",
  },
  {
    src: "/games/realms-eternum/cover.png",
    alt: "Eternum — the persistent hex world",
  },
];

function EternumPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative min-h-[100svh] overflow-hidden flex flex-col">
        <video
          className="absolute inset-0 h-full w-full object-cover mix-blend-screen opacity-70 saturate-130 contrast-110 scale-[1.03]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/og.jpg"
        >
          <source src="/videos/eternum-stub.mp4" type="video/mp4" />
        </video>

        <HexGridBackground
          colorPrimary="#4ecdc4"
          colorSecondary="#2a6f97"
          colorGlow="#00ffcc"
          className="z-[1]"
        />

        <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_75%_18%,rgba(244,198,124,0.22),transparent_40%),radial-gradient(circle_at_22%_78%,rgba(99,117,214,0.18),transparent_38%),linear-gradient(180deg,rgba(8,8,11,0.10)_0%,rgba(8,8,11,0.55)_50%,rgba(8,8,11,0.92)_100%)]" />

        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="container mx-auto px-4 text-center max-w-4xl">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="realm-banner mb-6"
            >
              Seasonal Onchain MMO
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="realm-title text-4xl sm:text-6xl md:text-7xl lg:text-8xl"
            >
              Conquer the Infinite Hex
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="mt-6 text-foreground/80 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            >
              4–8 week seasons on an infinite hex map. Command AI agents that
              play 24/7. Trade resources, forge alliances, crush enemies — the
              strongest empires take $LORDS.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button variant="war" size="lg" asChild>
                <a
                  href="https://eternum.realms.world/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Play Eternum
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button variant="oath" size="lg" asChild>
                <a href="#the-season">How It Works</a>
              </Button>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="relative z-10 pb-8 flex justify-center"
        >
          <a
            href="#the-season"
            className="text-foreground/50 hover:text-foreground/80 transition-colors"
            aria-label="Scroll to learn more"
          >
            <ChevronDown className="h-8 w-8 animate-bounce" />
          </a>
        </motion.div>
      </section>

      <div className="hex-grid-texture">
        {/* ── The Season ── */}
        <section id="the-season" className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="realm-banner mb-4">The Season</p>
              <h2 className="realm-title text-3xl sm:text-5xl md:text-6xl">
                4–8 Weeks. One Victor.
              </h2>
              <p className="mt-5 text-foreground/75 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Every season has a beginning, a climax, and winners. Here's how
                empires rise and fall.
              </p>
            </motion.div>

            <motion.div
              className="realm-panel rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-6 sm:p-8"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Desktop: horizontal timeline */}
              <div className="hidden md:grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-4">
                {seasonPhases.map((phase, i) => (
                  <Fragment key={phase.title}>
                    <div className="text-center px-2">
                      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border border-primary/25 mb-3">
                        <phase.icon className="h-7 w-7 text-primary" />
                      </div>
                      <p className="text-xs font-mono text-primary/60 mb-1">
                        {phase.weeks}
                      </p>
                      <h3 className="text-xl font-bold mb-2">{phase.title}</h3>
                      <p className="text-sm text-foreground/60 leading-relaxed">
                        {phase.description}
                      </p>
                    </div>
                    {i < seasonPhases.length - 1 && (
                      <div className="flex items-center pt-8">
                        <div className="w-10 h-px bg-gradient-to-r from-primary/15 via-primary/30 to-primary/15" />
                        <ChevronRight className="h-4 w-4 text-primary/35 -ml-1.5" />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>

              {/* Mobile: vertical timeline */}
              <div className="md:hidden flex flex-col gap-5">
                {seasonPhases.map((phase, i) => (
                  <Fragment key={phase.title}>
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/25 shrink-0">
                        <phase.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="pt-1">
                        <p className="text-xs font-mono text-primary/60 mb-0.5">
                          {phase.weeks}
                        </p>
                        <p className="text-base font-bold leading-tight mb-1">
                          {phase.title}
                        </p>
                        <p className="text-sm text-foreground/60 leading-relaxed">
                          {phase.description}
                        </p>
                      </div>
                    </div>
                    {i < seasonPhases.length - 1 && (
                      <div className="flex justify-center -my-2">
                        <ChevronDown className="h-4 w-4 text-primary/30" />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Three Pillars ── */}
        <section className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="realm-banner mb-4">Gameplay</p>
              <h2 className="realm-title text-3xl sm:text-5xl md:text-6xl">
                Your Agents. Your Empire.
              </h2>
              <p className="mt-5 text-foreground/75 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Set your strategy. Your AI agents execute around the clock on an
                infinite hex map.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {pillars.map((pillar, idx) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                  className="realm-panel realm-holo-card rounded-2xl border border-primary/20 bg-black/25 p-6 flex flex-col"
                >
                  <HexIconBadge
                    icon={pillar.icon}
                    size="md"
                    className="mb-4"
                  />
                  <h3 className="text-xl font-bold mb-2">{pillar.title}</h3>
                  <p className="text-sm text-foreground/70 mb-4 leading-relaxed">
                    {pillar.description}
                  </p>
                  <ul className="space-y-2 flex-1">
                    {pillar.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center gap-2.5 text-sm text-foreground/60"
                      >
                        <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Screenshots ── */}
        <section className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <p className="realm-banner mb-4">The World</p>
              <h2 className="realm-title text-3xl sm:text-5xl md:text-6xl">
                A Living Hex Map
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {screenshots.map((shot, idx) => (
                <motion.div
                  key={shot.src}
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="rounded-xl overflow-hidden border border-primary/20"
                >
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Onchain Trust ── */}
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
              <h2 className="realm-title text-3xl sm:text-5xl md:text-6xl">
                Every Move on Starknet
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {trustFeatures.map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                  className="rounded-xl border border-primary/15 bg-black/30 p-6 text-center"
                >
                  <HexIconBadge
                    icon={feature.icon}
                    size="md"
                    className="mb-4 mx-auto"
                  />
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-foreground/70 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative py-20 sm:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <HexCTAFrame color="#4ecdc4">
                <div className="text-center">
                  <p className="realm-banner mb-4">Next Season</p>
                  <h3 className="realm-title text-2xl sm:text-4xl mb-3">
                    The Map Is Waiting
                  </h3>
                  <p className="text-sm sm:text-base text-foreground/60 mb-6 max-w-md mx-auto">
                    Claim your first hex. Command your agents. Build an empire
                    that lasts.
                  </p>
                  <Button variant="war" size="lg" asChild>
                    <a
                      href="https://eternum.realms.world/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Play Eternum
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
