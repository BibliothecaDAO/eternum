import { motion } from "framer-motion";
import { games } from "@/data/games";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Coins,
  ExternalLink,
  Shield,
  Swords,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const liveGames = games.filter((game) => game.isLive);
const developmentGames = games.filter((game) => !game.isLive);
const sortedGames = [...liveGames, ...developmentGames];

const liveCount = liveGames.length;
const studioCount = new Set(games.map((game) => game.studio)).size;
const totalPlayers = games.reduce((sum, g) => sum + (g.players || 0), 0);

const blitzFeatures = [
  {
    icon: Swords,
    label: "Real-Time Strategy",
    detail: "Two-hour matches with live tactical decisions",
  },
  {
    icon: Bot,
    label: "Agent-Driven",
    detail: "AI agents execute your tactics onchain",
  },
  {
    icon: Shield,
    label: "Fully Verified",
    detail: "Every move auditable on Starknet",
  },
  {
    icon: Coins,
    label: "$LORDS Rewards",
    detail: "Earn real tokens as you compete",
  },
];

export function EcosystemAtlasSection() {
  return (
    <section className="realm-section relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-0 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        {/* Section header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-2xl">
            <p className="realm-banner mb-3">Games</p>
            <h2 className="realm-title text-3xl sm:text-4xl md:text-5xl mb-4">
              Agent-Native Worlds
            </h2>
            <p className="realm-subtitle text-base sm:text-lg">
              Onchain games built for AI agents. Compete, earn $LORDS, and
              verify every move.
            </p>
          </div>
          <Link
            to="/games"
            className="inline-flex items-center justify-center rounded-xl border border-primary/30 bg-black/30 px-4 py-3 text-sm uppercase tracking-[0.14em] text-primary/90 hover:border-primary/55 transition-colors realm-panel shrink-0"
          >
            All Games
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </motion.div>

        {/* ── Blitz Flagship Card ── */}
        <motion.div
          className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-black/40 mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
        >
          {/* Video background */}
          <video
            className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-screen saturate-150 scale-[1.02] transition-transform duration-700 group-hover:scale-[1.05]"
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
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

          {/* Content */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 p-6 sm:p-8 lg:p-10 min-h-[340px] sm:min-h-[400px]">
            {/* Left: Info */}
            <div className="flex flex-col justify-end">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <p className="realm-banner mb-3">
                  <Bot className="h-3.5 w-3.5" />
                  Flagship Agent Game
                </p>
                <h3 className="realm-title text-3xl sm:text-4xl md:text-5xl leading-tight mb-3">
                  Blitz
                </h3>
                <p className="text-base sm:text-lg text-foreground/85 max-w-xl mb-6 leading-relaxed">
                  A fast-paced onchain RTS where AI agents execute your tactics
                  in real-time. Two-hour matches, fully verified on Starknet,
                  with real $LORDS rewards for every win.
                </p>

                <div className="flex flex-wrap gap-3 mb-6">
                  <Button
                    size="lg"
                    variant="war"
                    className="shadow-lg shadow-primary/20"
                    asChild
                  >
                    <Link to="/blitz">
                      Enter Blitz
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="oath" asChild>
                    <Link to="/blitz">Learn More</Link>
                  </Button>
                </div>
              </motion.div>
            </div>

            {/* Right: Feature pills (desktop) */}
            <div className="hidden lg:flex flex-col justify-end gap-2.5 w-64">
              {blitzFeatures.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  className="flex items-center gap-3 rounded-xl border border-primary/20 bg-black/50 backdrop-blur-sm px-4 py-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                >
                  <feature.icon className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight">
                      {feature.label}
                    </p>
                    <p className="text-[10px] text-foreground/80 leading-tight">
                      {feature.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mobile feature row */}
          <div className="relative z-10 lg:hidden grid grid-cols-2 gap-2 px-6 pb-6 sm:px-8 sm:pb-8">
            {blitzFeatures.map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2 rounded-lg border border-primary/15 bg-black/40 backdrop-blur-sm px-3 py-2"
              >
                <feature.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-[10px] font-semibold leading-tight">
                  {feature.label}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Social proof + games grid header ── */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <p className="flex items-center gap-2 text-sm text-foreground/80">
            <Users className="h-3.5 w-3.5" />
            {totalPlayers.toLocaleString()}+ players across {liveCount} live
            worlds built by {studioCount} studios
          </p>
          <p className="realm-banner">Ecosystem</p>
        </motion.div>

        {/* ── Games grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {sortedGames.map((game, index) => (
            <motion.article
              key={game.slug}
              className={`group relative overflow-hidden rounded-2xl border border-primary/20 bg-black/25 backdrop-blur-sm aspect-[16/10] realm-panel realm-holo-card ${!game.isLive ? "opacity-60" : ""}`}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: game.isLive ? 1 : 0.6, y: 0 }}
              transition={{ delay: 0.35 + 0.06 * index, duration: 0.45 }}
            >
              <img
                src={game.image}
                alt={game.title}
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />

              <div className="relative flex h-full flex-col justify-end p-4 sm:p-5">
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  {game.isLive ? (
                    <span className="realm-sigil text-green-400 border-green-500/30">
                      Live
                    </span>
                  ) : (
                    <span className="realm-sigil text-foreground/65">
                      Coming Soon
                    </span>
                  )}
                </div>

                {/* Player count badge */}
                {game.players && (
                  <div className="absolute top-3 left-3">
                    <span className="realm-sigil">
                      <Users className="h-2.5 w-2.5 mr-1 inline" />
                      {game.players.toLocaleString()}
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-semibold mb-1.5">{game.title}</h3>
                <p className="text-xs text-foreground/80 mb-2.5 line-clamp-2">
                  {game.description}
                </p>

                {/* Genre tags */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {game.genre?.slice(0, 3).map((genre) => (
                    <span
                      key={`${game.slug}-${genre}`}
                      className="realm-sigil text-[9px]"
                    >
                      {genre}
                    </span>
                  ))}
                  <span className="realm-sigil text-[9px] text-foreground/80">
                    {game.studio}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  {game.isLive && game.links?.homepage && (
                    <a
                      href={game.links.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      Play Now <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                  <Link
                    to="/games/$slug"
                    params={{ slug: game.slug }}
                    className="inline-flex items-center text-xs text-foreground/80 hover:text-primary transition-colors"
                  >
                    Details <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Link>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
