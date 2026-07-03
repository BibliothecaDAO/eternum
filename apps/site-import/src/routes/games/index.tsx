import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";
import type { Game } from "@/data/games";

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
        "Explore onchain games in the Realms ecosystem, including worlds built for human players, AI agents, and $LORDS-powered economies.",
      path: "/games",
    }),
  }),
});

const gamesDirectoryOrder = [
  "blitz",
  "realms-eternum",
  "loot-survivor",
  "blob-arena",
  "dark-shuffle",
  "zkube",
  "pistols-at-dawn",
  "rising-revenant",
];

function orderGames(games: Game[]) {
  const gamesBySlug = new Map(games.map((game) => [game.slug, game]));
  return gamesDirectoryOrder
    .map((slug) => gamesBySlug.get(slug))
    .filter((game): game is Game => Boolean(game));
}

const blitzGrab =
  "Blitz is a one-hour, fully onchain real-time strategy game where human players and AI agents compete over territory, resources, and Hyperstructures. Every match is fully onchain and verifiable, with top-ranked players sharing the $LORDS prize pool.";

const blitzFeaturedDetail =
  "Each player begins with three equally capable Realms and must turn them into an economy, supply network, and military powerhouse. Exploration pushes back the fog of war, uncovering key strategic opportunities across the battlefield. Armies scout, defend key holdings, strike neighbouring positions, and fight across various biomes that can impact their combat effectiveness. Hyperstructures, placed at regular intervals on the map, are key objectives and decisive flashpoints, rewarding players who claim and maintain control at the right moments. Exploring the map and controlling key objectives earns Victory Points, which determine leaderboard placement and prize eligibility.";

function statusChipClasses(status: string) {
  if (status === "mainnet") {
    return "bg-emerald-400/15 text-emerald-300 border-emerald-400/35";
  }
  if (status === "testnet") {
    return "bg-amber-300/15 text-amber-200 border-amber-300/35";
  }

  return "bg-slate-300/10 text-slate-200 border-slate-300/30";
}

function gameGenreTags(game: { genre?: string[]; studio: string }) {
  return (game.genre || []).filter((tag) => tag !== game.studio).slice(0, 3);
}

function GamesPage() {
  const navigate = useNavigate();
  const { games } = Route.useLoaderData();

  const orderedGames = orderGames(games);
  const featuredGame = orderedGames[0];
  const secondaryGames = orderedGames.slice(1);
  const liveGamesCount = games.filter((game) => game.isLive).length;
  const studiosCount = new Set(games.map((game) => game.studio)).size;

  return (
    <section className="realm-section realm-games-stage relative overflow-hidden py-10 sm:py-14">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-6 sm:space-y-8"
        >
          <header className="realm-panel realm-grid-scan realm-games-hero rounded-lg p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div className="max-w-3xl">
                <h1 className="realm-title text-3xl leading-tight sm:text-4xl lg:text-5xl">
                  Games Directory
                </h1>
                <p className="mt-3 text-base text-foreground/80 sm:text-lg">
                  Browse live and in-development games shipping across the
                  Realms.World ecosystem. Access more information, socials and
                  gameplay links on individual game pages.
                </p>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <span className="realm-sigil">{games.length} games listed</span>
              </div>
            </div>
            <div className="realm-games-metrics mt-5 sm:!grid-cols-2">
              <article className="realm-games-metric">
                <p className="realm-sigil">Live Games</p>
                <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                  {liveGamesCount}
                </p>
              </article>
              <article className="realm-games-metric">
                <p className="realm-sigil">Aligned Studios</p>
                <p className="mt-2 text-2xl font-semibold text-primary tabular-nums">
                  {studiosCount}
                </p>
              </article>
            </div>
          </header>

          {featuredGame ? (
            <motion.button
              type="button"
              className="group realm-panel realm-grid-scan realm-games-feature overflow-hidden rounded-lg text-left"
              onClick={() =>
                navigate({ to: "/games/$slug", params: { slug: featuredGame.slug } })
              }
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              whileHover={{ y: -4 }}
            >
              <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
                <div className="relative min-h-[16rem] overflow-hidden border-b border-primary/20 sm:min-h-[20rem] lg:border-b-0 lg:border-r">
                  <img
                    src={featuredGame.backgroundImage || featuredGame.image}
                    alt={featuredGame.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent lg:bg-gradient-to-t lg:from-black/65 lg:via-black/20 lg:to-transparent" />
                </div>
                <div className="p-5 sm:p-6 lg:py-7">
                  <p className="realm-banner">Featured Game</p>
                  <h2 className="mt-3 text-3xl font-semibold text-foreground transition-colors group-hover:text-primary sm:text-4xl lg:text-5xl">
                    {featuredGame.title}
                  </h2>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-foreground/70 sm:text-base">
                    {featuredGame.studio}
                  </p>
                  <p className="mt-5 text-sm font-bold leading-relaxed text-foreground/90 sm:text-base">
                    {blitzGrab}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-foreground/78">
                    {blitzFeaturedDetail}
                  </p>
                  <div className="mt-5 flex flex-nowrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {gameGenreTags(featuredGame).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-primary/25 bg-black/35 px-2 py-0.5 text-[11px] text-foreground/75"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="realm-sigil realm-studio-tag ml-auto shrink-0 text-[11px]">
                      {featuredGame.studio}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {featuredGame.isLive ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-black/45 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-300">
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Live
                      </span>
                    ) : null}
                    <span
                      className={
                        "rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] " +
                        statusChipClasses(featuredGame.status)
                      }
                    >
                      {featuredGame.status}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          ) : null}

          {secondaryGames.length > 0 ? (
            <div className="realm-games-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
              {secondaryGames.map((game, index) => (
                <motion.button
                  key={game.id}
                  type="button"
                  className="group realm-panel realm-holo-card realm-games-card flex h-full flex-col overflow-hidden rounded-lg text-left"
                  onClick={() =>
                    navigate({ to: "/games/$slug", params: { slug: game.slug } })
                  }
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.03 }}
                  whileHover={{ y: -4 }}
                >
                  <div className="realm-games-card-media relative aspect-[16/10] overflow-hidden border-b border-primary/20 bg-black/40">
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
                        className={
                          "rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] " +
                          statusChipClasses(game.status)
                        }
                      >
                        {game.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <h2 className="text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
                      {game.title}
                    </h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-foreground/55">
                      {game.studio}
                    </p>
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-foreground/78">
                      {game.description}
                    </p>

                    <div className="mt-4 flex flex-nowrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {gameGenreTags(game).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-primary/25 bg-black/35 px-2 py-0.5 text-[11px] text-foreground/75"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="realm-sigil realm-studio-tag ml-auto shrink-0 text-[11px]">
                        {game.studio}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
