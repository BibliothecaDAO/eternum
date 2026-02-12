import { motion } from "framer-motion";
import { games } from "@/data/games";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

const atlasGames = games.slice(0, 8);
const liveCount = games.filter((game) => game.isLive).length;

export function EcosystemAtlasSection() {
  return (
    <section className="relative py-20 sm:py-24">
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
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/90 mb-3">
              Ecosystem Atlas
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl">
              Live Games, Linked Worlds
            </h2>
          </div>
          <div className="rounded-xl border border-primary/30 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-primary/90">
              Live Right Now
            </p>
            <p className="text-3xl font-bold">{liveCount}</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {atlasGames.map((game, index) => (
            <motion.article
              key={game.slug}
              className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-black/25 backdrop-blur-sm min-h-[220px]"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index, duration: 0.45 }}
            >
              <img
                src={game.image}
                alt={game.title}
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
              <div className="relative p-5 flex h-full flex-col justify-end">
                <p className="text-xs uppercase tracking-[0.16em] text-primary/90 mb-2">
                  {game.isLive ? "Live Realm" : "Realm In Forging"}
                </p>
                <h3 className="text-xl font-semibold mb-3">{game.title}</h3>
                <p className="text-sm text-foreground/75 mb-4 line-clamp-2">
                  {game.description}
                </p>
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
    </section>
  );
}
