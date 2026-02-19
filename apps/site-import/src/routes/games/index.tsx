import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { generateMetaTags } from "@/lib/og-image";

export const Route = createFileRoute("/games/")({
  loader: async () => {
    const { games } = await import("@/data/games");
    return { games };
  },
  component: GamesPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Games - Realms World",
      description:
        "Explore all games in the Realms World ecosystem. Discover onchain games powered by $LORDS token.",
      path: "/games",
    }),
  }),
});

function GamesPage() {
  const navigate = useNavigate();
  const { games } = Route.useLoaderData();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");

  const allGenres = useMemo(
    () => Array.from(new Set(games.flatMap((game) => game.genre || []))).sort(),
    [games]
  );

  const filteredGames = useMemo(
    () =>
      games.filter((game) => {
        const statusMatch =
          selectedStatus === "all" || game.status === selectedStatus;
        const genreMatch =
          selectedGenre === "all" ||
          (game.genre && game.genre.includes(selectedGenre));

        return statusMatch && genreMatch;
      }),
    [games, selectedStatus, selectedGenre]
  );
  const featuredGame = filteredGames[0];
  const secondaryGames = filteredGames.slice(1);
  const liveGamesCount = useMemo(
    () => games.filter((game) => game.isLive).length,
    [games]
  );
  const mainnetGamesCount = useMemo(
    () => games.filter((game) => game.status === "mainnet").length,
    [games]
  );
  const studiosCount = useMemo(
    () => new Set(games.map((game) => game.studio)).size,
    [games]
  );

  const statusChipClasses = (status: string) => {
    if (status === "mainnet") {
      return "bg-emerald-400/15 text-emerald-300 border-emerald-400/35";
    }
    if (status === "testnet") {
      return "bg-amber-300/15 text-amber-200 border-amber-300/35";
    }

    return "bg-slate-300/10 text-slate-200 border-slate-300/30";
  };

  return (
    <section className="realm-section realm-games-stage relative py-10 sm:py-14">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-6 sm:space-y-8"
        >
          <header className="realm-panel realm-grid-scan realm-games-hero rounded-2xl p-5 sm:p-7 lg:p-8">
            <p className="realm-banner mb-4">War Table Directory</p>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div className="max-w-3xl">
                <h1 className="realm-title text-3xl sm:text-4xl lg:text-5xl leading-tight">
                  Realms Campaign Grid
                </h1>
                <p className="mt-3 text-foreground/80 text-base sm:text-lg">
                  Survey active fronts, filter by deployment status, and move from
                  scouting to play in one pass. This is the live command view for games
                  shipping across the Realms ecosystem.
                </p>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <span className="realm-sigil">{games.length} listed</span>
                <span className="realm-sigil">{filteredGames.length} visible</span>
              </div>
            </div>
            <div className="realm-games-metrics mt-5">
              <article className="realm-games-metric">
                <p className="realm-sigil">Live Realms</p>
                <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                  {liveGamesCount}
                </p>
              </article>
              <article className="realm-games-metric">
                <p className="realm-sigil">Studios Forging</p>
                <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                  {studiosCount}
                </p>
              </article>
              <article className="realm-games-metric">
                <p className="realm-sigil">Mainnet Live</p>
                <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                  {mainnetGamesCount}
                </p>
              </article>
            </div>
          </header>

          <div className="realm-panel realm-games-filterbar rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
                <span className="realm-sigil">Status</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="realm-games-select rounded-md border border-primary/30 bg-black/35 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60"
                >
                  <option value="all">All</option>
                  <option value="mainnet">Mainnet</option>
                  <option value="testnet">Testnet</option>
                  <option value="development">Development</option>
                </select>
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
                <span className="realm-sigil">Genre</span>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="realm-games-select rounded-md border border-primary/30 bg-black/35 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/60"
                >
                  <option value="all">All Genres</option>
                  {allGenres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {featuredGame ? (
            <motion.button
              type="button"
              className="group realm-panel realm-grid-scan realm-games-feature text-left rounded-2xl overflow-hidden"
              onClick={() => navigate({ to: `/games/${featuredGame.slug}` })}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              whileHover={{ y: -4 }}
            >
              <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
                <div className="relative min-h-[16rem] sm:min-h-[20rem] overflow-hidden border-b border-primary/20 lg:border-b-0 lg:border-r">
                  <img
                    src={featuredGame.backgroundImage || featuredGame.image}
                    alt={featuredGame.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent lg:bg-gradient-to-t lg:from-black/65 lg:via-black/20 lg:to-transparent" />
                </div>
                <div className="p-5 sm:p-6 lg:py-7">
                  <p className="realm-banner">Featured Front</p>
                  <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-foreground group-hover:text-primary transition-colors">
                    {featuredGame.title}
                  </h2>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-foreground/55">
                    {featuredGame.studio}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-foreground/80 line-clamp-4">
                    {featuredGame.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(featuredGame.genre || []).slice(0, 5).map((genre) => (
                      <span
                        key={genre}
                        className="rounded-md border border-primary/25 bg-black/35 px-2 py-0.5 text-[11px] text-foreground/75"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {featuredGame.isLive ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-black/45 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-300">
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Live
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${statusChipClasses(
                        featuredGame.status
                      )}`}
                    >
                      {featuredGame.status}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          ) : null}

          {secondaryGames.length > 0 ? (
            <div className="realm-games-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 xl:gap-6">
              {secondaryGames.map((game, index) => (
                <motion.button
                  key={game.id}
                  type="button"
                  className="group realm-panel realm-holo-card realm-games-card text-left rounded-2xl overflow-hidden"
                  onClick={() => navigate({ to: `/games/${game.slug}` })}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.03 }}
                  whileHover={{ y: -4 }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden border-b border-primary/20">
                    <img
                      src={game.image}
                      alt={game.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      {game.isLive ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-black/45 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-300">
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          Live
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${statusChipClasses(
                          game.status
                        )}`}
                      >
                        {game.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                      {game.title}
                    </h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-foreground/55">
                      {game.studio}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-foreground/78 line-clamp-3">
                      {game.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(game.genre || []).slice(0, 4).map((genre) => (
                        <span
                          key={genre}
                          className="rounded-md border border-primary/25 bg-black/35 px-2 py-0.5 text-[11px] text-foreground/75"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    {game.players ? (
                      <p className="mt-4 text-xs text-foreground/60">
                        {game.players.toLocaleString()} tracked players
                      </p>
                    ) : null}
                  </div>
                </motion.button>
              ))}
            </div>
          ) : null}

          {filteredGames.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="realm-panel rounded-xl p-8 text-center"
            >
              <p className="text-foreground/70">No games found matching your filters.</p>
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
