import { createFileRoute } from "@tanstack/react-router";
import { games } from "@/data/games";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/games/")({
  component: GamesPage,
  head: () => ({
    meta: [
      {
        title: "Games - Realms World",
      },
      {
        name: "description",
        content: "Explore all games in the Realms World ecosystem",
      },
      {
        property: "og:title",
        content: "Games - Realms World",
      },
      {
        property: "og:description",
        content: "Explore all games in the Realms World ecosystem",
      },
    ],
  }),
});

function GamesPage() {
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");

  // Get unique genres from all games
  const allGenres = Array.from(
    new Set(games.flatMap((game) => game.genre || []))
  ).sort();

  // Filter games based on selected filters
  const filteredGames = games.filter((game) => {
    const statusMatch =
      selectedStatus === "all" || game.status === selectedStatus;
    const genreMatch =
      selectedGenre === "all" ||
      (game.genre && game.genre.includes(selectedGenre));
    return statusMatch && genreMatch;
  });

  const handleGameClick = (gameSlug: string) => {
    navigate({ to: `/games/${gameSlug}` });
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl md:text-4xl font-bold mb-8">All Games</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All</option>
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
              <option value="development">Development</option>
            </select>
          </div>

          {/* Genre Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Genre:</label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Genres</option>
              {allGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game, index) => (
            <motion.div
              key={game.id}
              className="group cursor-pointer"
              onClick={() => handleGameClick(game.slug)}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: index * 0.05,
                type: "spring",
                damping: 20,
                stiffness: 100,
              }}
              whileHover={{ y: -5 }}
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-card">
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />

                {/* Status Badge */}
                {game.isLive && (
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center bg-card/80 backdrop-blur-sm px-2 py-1 rounded-full">
                      <motion.div
                        className="w-2 h-2 rounded-full bg-positive mr-2"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-xs font-medium">Live</span>
                    </div>
                  </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Game Info */}
              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  {game.title}
                </h3>

                <p className="text-sm text-muted-foreground line-clamp-2">
                  {game.description}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Studio */}
                  <span className="text-muted-foreground">
                    by {game.studio}
                  </span>

                  {/* Status Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full capitalize ${
                      game.status === "mainnet"
                        ? "bg-positive/20 text-positive"
                        : game.status === "testnet"
                        ? "bg-warning/20 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {game.status}
                  </span>

                  {/* Player Count */}
                  {game.players && (
                    <span className="text-muted-foreground">
                      {game.players.toLocaleString()} players
                    </span>
                  )}
                </div>

                {/* Genres */}
                {game.genre && game.genre.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {game.genre.map((g) => (
                      <span
                        key={g}
                        className="text-xs px-2 py-0.5 bg-muted rounded-md"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* No Results */}
        {filteredGames.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-muted-foreground">
              No games found matching your filters.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
