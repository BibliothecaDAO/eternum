import { createFileRoute } from "@tanstack/react-router";
import { games } from "@/data/games";
// import { AnimatedBackground } from "@/components/AnimatedBackground";
import { GameDetails } from "@/components/game/GameDetails";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

export const Route = createFileRoute("/games/$slug")({
  loader: ({ params }) => {
    const game = games.find((g) => g.slug === params.slug);
    if (!game) {
      throw new Error("Game not found");
    }
    return { game };
  },
  component: GamePage,
});

function GamePage() {
  const { game } = Route.useLoaderData();

  // Use the origin from window.location or a default for SSR
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://realms.world";

  return (
    <>
      <Helmet>
        <title>{`${game.title} - Realms World`}</title>
        <meta name="description" content={game.description} />

        {/* Open Graph tags */}
        <meta property="og:title" content={`${game.title} - Realms World`} />
        <meta property="og:description" content={game.description} />
        <meta
          property="og:image"
          content={`${origin}/api/og?title=${encodeURIComponent(
            game.title
          )}&description=${encodeURIComponent(
            game.description
          )}&path=${encodeURIComponent(`/games/${game.slug}`)}`}
        />
        <meta property="og:type" content="website" />

        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${game.title} - Realms World`} />
        <meta name="twitter:description" content={game.description} />
        <meta
          name="twitter:image"
          content={`${origin}/api/og?title=${encodeURIComponent(
            game.title
          )}&description=${encodeURIComponent(
            game.description
          )}&path=${encodeURIComponent(`/games/${game.slug}`)}`}
        />
      </Helmet>

      {/* Game-specific background */}
      {/* <div className="fixed inset-0 -z-10">
        <AnimatedBackground selectedGame={game} />
      </div> */}

      {/* Game content with proper spacing */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 min-h-screen"
      >
        <GameDetails game={game} />
      </motion.div>
    </>
  );
}
