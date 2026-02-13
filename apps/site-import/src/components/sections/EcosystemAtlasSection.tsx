import { motion } from "framer-motion";
import { games } from "@/data/games";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const atlasGames = games.slice(0, 8);
const liveCount = games.filter((game) => game.isLive).length;
const inForgingCount = games.filter((game) => !game.isLive).length;
const studioCount = new Set(games.map((game) => game.studio)).size;

const atlasSnapshot = [
  {
    label: "Live Worlds",
    value: liveCount.toString(),
    helper: "Playable now",
  },
  {
    label: "In Forging",
    value: inForgingCount.toString(),
    helper: "Shipping next",
  },
  {
    label: "Studios",
    value: studioCount.toString(),
    helper: "Teams building",
  },
];

export function EcosystemAtlasSection() {
  return (
    <section className="realm-section relative py-20 sm:py-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-0 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="max-w-2xl">
            <p className="realm-banner mb-3">
              Ecosystem Atlas
            </p>
            <h2 className="realm-title text-3xl sm:text-4xl md:text-5xl mb-4">
              Live Games, Linked Worlds
            </h2>
            <p className="realm-subtitle text-base sm:text-lg">
              Discover where to play now, what is launching next, and how each
              game fits into the wider Realms strategy ecosystem.
            </p>
          </div>
          <Link
            to="/games"
            className="inline-flex items-center justify-center rounded-xl border border-primary/30 bg-black/30 px-4 py-3 text-sm uppercase tracking-[0.14em] text-primary/90 hover:border-primary/55 transition-colors realm-panel"
          >
            View Full Ecosystem
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          className="realm-panel realm-edge-brackets realm-grid-scan mb-8 rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-5 sm:p-6"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h3 className="realm-banner mb-4">
            Atlas Snapshot
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {atlasSnapshot.map((item) => (
              <div key={item.label} className="card-relic realm-holo-card rounded-xl border border-primary/15 p-4">
                <p className="realm-sigil mb-2">
                  {item.label}
                </p>
                <p className="text-2xl font-semibold mb-1">{item.value}</p>
                <p className="text-xs text-foreground/60">{item.helper}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="realm-journey-map rounded-2xl p-1 sm:p-2">
          <div className="realm-journey-path" aria-hidden />
          <div className="space-y-4">
            {atlasGames.map((game, index) => (
              <motion.article
                key={game.slug}
                className="realm-world-node group relative overflow-hidden rounded-2xl border border-primary/20 bg-black/25 backdrop-blur-sm min-h-[220px] realm-panel realm-holo-card realm-grid-scan p-5 sm:p-6 sm:max-w-[88%] sm:even:ml-auto lg:max-w-[82%]"
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * index, duration: 0.45 }}
              >
                <img
                  src={game.image}
                  alt={game.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/45 to-black/10" />
                <div className="relative flex h-full flex-col justify-end">
                  <p className="realm-sigil mb-1">
                    {game.isLive ? "Live Realm" : "Realm In Forging"}
                  </p>
                  <h3 className="text-2xl font-semibold mb-2">{game.title}</h3>
                  <p className="text-sm text-foreground/75 mb-3 line-clamp-2">
                    {game.description}
                  </p>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {game.genre?.slice(0, 2).map((genre) => (
                      <span
                        key={`${game.slug}-${genre}`}
                        className="realm-sigil"
                      >
                        {genre}
                      </span>
                    ))}
                    <span className="realm-sigil text-foreground/80">
                      {game.studio}
                    </span>
                  </div>
                  <Link
                    to="/games/$slug"
                    params={{ slug: game.slug }}
                    className="inline-flex items-center text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Enter Realm <ArrowUpRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
