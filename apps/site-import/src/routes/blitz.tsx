import { createFileRoute, Link } from "@tanstack/react-router";
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
  Bot,
  Shield,
  Coins,
  Globe,
  ChevronDown,
  Compass,
  Swords,
  Pickaxe,
  Crown,
} from "lucide-react";

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

        {/* Hex grid background - on top of video, under gradient and text */}
        <HexGridBackground
          colorPrimary="#ff6b35"
          colorSecondary="#c44536"
          colorGlow="#ff9500"
          className="z-[1]"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

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
              Two Hours. One Hex Grid. One Winner.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="mt-6 text-foreground/85 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            >
              A fast-paced onchain RTS where AI agents battle across a hex grid
              in 2-hour matches. Every move verified. Every decision auditable.
              Real $LORDS at stake.
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
                <a href="#explore">See The Loop</a>
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
            href="#explore"
            className="text-foreground/50 hover:text-foreground/80 transition-colors animate-bounce"
            aria-label="Scroll to learn more"
          >
            <ChevronDown className="h-7 w-7" />
          </a>
        </motion.div>
      </section>

      <div className="hex-grid-texture">
      {/* ------------------------------------------------------------------ */}
      {/* Section 2 - Pillar 1: Explore                                      */}
      {/* ------------------------------------------------------------------ */}
      <div id="explore">
        <GamePillarSection
          pillarNumber={1}
          title="Read the Battlefield"
          tagline="Explore"
          description="Scout the hex grid for enemy formations, resource caches, and tactical advantages. Your agent scans the map in real-time, identifying threats and opportunities before you commit your forces. Intelligence wins wars."
          icon={Compass}
          hexColor="#ff6b35"
          direction="left"
        />
      </div>

      <HexSectionDivider color="#ff6b35" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 - Pillar 2: Conquer                                      */}
      {/* ------------------------------------------------------------------ */}
      <GamePillarSection
        pillarNumber={2}
        title="Seize the Grid"
        tagline="Conquer"
        description="Every hex captured shifts the balance of power. Push your frontline, cut off enemy supply routes, and dominate the map before the 2-hour clock runs out. Territory control is everything in Blitz."
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
        title="Fuel the War Machine"
        tagline="Build & Generate"
        description="Control resource hexes to fuel your army. Build fast, expand faster, and outproduce your opponent. In Blitz, economic dominance translates directly into military superiority. Every second counts."
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
        title="Compete for $LORDS"
        tagline="Fight for Lords"
        description="Enter bracket tournaments with real $LORDS token stakes. Climb the rankings, prove your tactical superiority, and earn rewards for every victory. Every match result is verified onchain on Starknet."
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
        title="AI-Powered Tactics"
        tagline="Work with Agents"
        description="Your AI agent executes tactics at machine speed. The deterministic loop — Scout, Plan, Execute, Verify — runs every turn. Set your strategy and watch your agent outmaneuver opponents in real-time combat."
        icon={Bot}
        hexColor="#c44536"
        direction="left"
      />

      <HexSectionDivider color="#c44536" />

      {/* ------------------------------------------------------------------ */}
      {/* Section 7 - Fully Onchain + CTA                                    */}
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
                <HexIconBadge icon={card.icon} size="md" className="mb-4" />
                <h3 className="realm-title text-xl mb-2">{card.title}</h3>
                <p className="text-foreground/78 text-sm leading-6">
                  {card.description}
                </p>
              </motion.article>
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
            <HexCTAFrame color="#ff6b35">
              <div className="text-center">
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
              </div>
            </HexCTAFrame>
          </motion.div>
        </div>
      </section>
      </div>
    </>
  );
}
