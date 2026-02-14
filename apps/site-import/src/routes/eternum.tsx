import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import { Button } from "@/components/ui/button";
import { HexGridBackground } from "@/components/HexGridBackground";
import { GamePillarSection } from "@/components/GamePillarSection";
import { HexSectionDivider } from "@/components/HexSectionDivider";
import { HexIconBadge } from "@/components/HexIconBadge";
import { HexCTAFrame } from "@/components/HexCTAFrame";
import {
  ArrowRight,
  Shield,
  Coins,
  Globe,
  Swords,
  ChevronDown,
  Compass,
  Pickaxe,
  Crown,
  Bot,
} from "lucide-react";

export const Route = createFileRoute("/eternum")({
  component: EternumPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Eternum - Onchain MMO Strategy | Realms World",
      description:
        "Command your AI agent in Eternum, a seasonal onchain MMO. Manage resources, forge alliances, and conquer persistent worlds on Starknet.",
      path: "/eternum",
    }),
  }),
});

const trustFeatures = [
  {
    icon: Shield,
    title: "100% Onchain",
    description:
      "All game state lives on Starknet. Your assets, progress, and achievements are truly yours.",
  },
  {
    icon: Coins,
    title: "Live $LORDS Economy",
    description:
      "Real token economics powering in-game trade, rewards, and governance decisions.",
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
    alt: "Eternum gameplay screenshot - strategic overview",
  },
  {
    src: "/games/realms-eternum/screenshots/2.png",
    alt: "Eternum gameplay screenshot - battle scene",
  },
  {
    src: "/games/realms-eternum/screenshots/3.png",
    alt: "Eternum gameplay screenshot - world map",
  },
  {
    src: "/games/realms-eternum/cover.png",
    alt: "Eternum cover art - the persistent world",
  },
];

function EternumPage() {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Section 1 - Full-bleed Hero                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-[100svh] overflow-hidden flex flex-col">
        {/* Video background - lowest z-index */}
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

        {/* Hex grid layer - on top of video, under gradient and text */}
        <HexGridBackground
          colorPrimary="#4ecdc4"
          colorSecondary="#2a6f97"
          colorGlow="#00ffcc"
          className="z-[1]"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_75%_18%,rgba(244,198,124,0.22),transparent_40%),radial-gradient(circle_at_22%_78%,rgba(99,117,214,0.18),transparent_38%),linear-gradient(180deg,rgba(8,8,11,0.10)_0%,rgba(8,8,11,0.55)_50%,rgba(8,8,11,0.92)_100%)]" />

        {/* Centered hero content */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="container mx-auto px-4 text-center max-w-4xl">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="realm-banner mb-6"
            >
              Flagship MMO
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="realm-title text-4xl sm:text-6xl md:text-7xl lg:text-8xl"
            >
              Conquer the Hex
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="mt-6 text-foreground/80 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            >
              A seasonal onchain MMO where you command AI agents across a
              persistent hex-grid world. Explore territories, build empires,
              forge alliances, and fight for $LORDS on Starknet.
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
                <a href="#agent-gameplay">How It Works</a>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Bouncing scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="relative z-10 pb-8 flex justify-center"
        >
          <a
            href="#agent-gameplay"
            className="text-foreground/50 hover:text-foreground/80 transition-colors"
            aria-label="Scroll to learn more"
          >
            <ChevronDown className="h-8 w-8 animate-bounce" />
          </a>
        </motion.div>
      </section>

      <div className="hex-grid-texture">
      {/* ------------------------------------------------------------------ */}
      {/* Section 2 - Pillar 1: Explore                                      */}
      {/* ------------------------------------------------------------------ */}
      <div id="agent-gameplay" />
      <GamePillarSection
        pillarNumber={1}
        title="Scout the Unknown"
        tagline="Explore"
        description="Send your agents deep into uncharted hex territories. Discover resource nodes, map enemy positions, and uncover strategic chokepoints — all before you even log in. The fog of war lifts hex by hex as your scouts push further into the unknown."
        icon={Compass}
        hexColor="#4ecdc4"
        direction="left"
      />

      <HexSectionDivider color="#4ecdc4" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 - Pillar 2: Conquer                                      */}
      {/* ------------------------------------------------------------------ */}
      <GamePillarSection
        pillarNumber={2}
        title="Claim Every Hex"
        tagline="Conquer"
        description="Expand your realm hex by hex across the persistent world. Fortify your borders, push into enemy territory, and defend strategic positions. Every hex you hold strengthens your empire and weakens your rivals."
        icon={Swords}
        hexColor="#e63946"
        direction="right"
      />

      <HexSectionDivider color="#e63946" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 4 - Pillar 3: Build & Generate Resources                   */}
      {/* ------------------------------------------------------------------ */}
      <GamePillarSection
        pillarNumber={3}
        title="Build Your Empire"
        tagline="Build & Generate"
        description="Every hex you control generates resources. Construct buildings, optimize trade routes, and grow your economy while you sleep. Your agents manage production and logistics around the clock, turning territory into wealth."
        icon={Pickaxe}
        hexColor="#f4a261"
        direction="left"
      />

      <HexSectionDivider color="#f4a261" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 5 - Pillar 4: Fight for Lords                              */}
      {/* ------------------------------------------------------------------ */}
      <GamePillarSection
        pillarNumber={4}
        title="Battle for $LORDS"
        tagline="Fight for Lords"
        description="Every conquest, every trade, every victory feeds into a real token economy on Starknet. Compete in seasonal campaigns where the stakes are real $LORDS tokens. The strongest empires earn the greatest rewards."
        icon={Crown}
        hexColor="#e9c46a"
        direction="right"
      />

      <HexSectionDivider color="#e9c46a" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 6 - Pillar 5: Work with Agents                             */}
      {/* ------------------------------------------------------------------ */}
      <GamePillarSection
        pillarNumber={5}
        title="Deploy Your AI Army"
        tagline="Work with Agents"
        description="Deploy autonomous AI agents that play on your behalf 24/7. They scout, trade, negotiate alliances, and lead battles in the persistent world. Set your strategy and let your agents execute while you're away."
        icon={Bot}
        hexColor="#2a9d8f"
        direction="left"
      />

      <HexSectionDivider color="#2a9d8f" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 7 - Fully Onchain & Secure                                 */}
      {/* ------------------------------------------------------------------ */}
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
              Every Move Verified on Starknet
            </h2>
            <p className="mt-5 text-foreground/75 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              No hidden servers. No black boxes. Every action, trade, and battle
              is recorded onchain for complete transparency.
            </p>
          </motion.div>

          <div className="realm-panel realm-grid-scan rounded-xl p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {trustFeatures.map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                  className="card-relic rounded-xl p-6"
                >
                  <HexIconBadge icon={feature.icon} size="md" className="mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-foreground/70 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Screenshot Gallery                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative py-20 sm:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="realm-banner mb-4">Explore The World</p>
            <h2 className="realm-title text-3xl sm:text-5xl md:text-6xl">
              A Living, Breathing Realm
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

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mt-16 text-center"
          >
            <HexCTAFrame color="#4ecdc4">
              <div className="text-center">
                <h3 className="realm-title text-2xl sm:text-4xl mb-6">
                  Ready to Command?
                </h3>
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
