import { createFileRoute } from "@tanstack/react-router";
import { games } from "@/data/games";
// import { AnimatedBackground } from "@/components/AnimatedBackground";
import { GameDetails } from "@/components/game/GameDetails";
import { motion } from "framer-motion";

export const Route = createFileRoute("/games/$slug")({
  loader: ({ params }) => {
    const game = games.find((g) => g.slug === params.slug);
    if (!game) {
      throw new Error("Game not found");
    }
    return { game };
  },
  component: GamePage,
  head: ({ loaderData }) => {
    const game = loaderData?.game;
    if (!game) return {};

    // Use the origin from window.location or a default for SSR
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://realms.world";

    return {
      meta: [
        {
          title: `${game.title} - Realms World`,
        },
        {
          name: "description",
          content: game.description,
        },
        {
          property: "og:title",
          content: `${game.title} - Realms World`,
        },
        {
          property: "og:description",
          content: game.description,
        },
        {
          property: "og:image",
          content: `${origin}${game.image}`,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: `${game.title} - Realms World`,
        },
        {
          name: "twitter:description",
          content: game.description,
        },
        {
          name: "twitter:image",
          content: `${origin}${game.image}`,
        },
      ],
    };
  },
});

function GamePage() {
  const { game } = Route.useLoaderData();

  return (
    <>
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
