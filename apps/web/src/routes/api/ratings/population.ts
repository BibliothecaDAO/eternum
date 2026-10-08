import { createFileRoute } from "@tanstack/react-router";
import { readRatingPopulation, readRatingHistoryHead } from "@/lib/rating-population";

export const Route = createFileRoute("/api/ratings/population")({
  server: {
    handlers: {
      HEAD: async () => {
        try {
          const head = await readRatingHistoryHead();
          return new Response(null, {
            headers: {
              "cache-control": "no-store",
              "x-rating-block": String(head.block_number),
              "x-rating-hash": head.block_hash,
            },
          });
        } catch {
          return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
        }
      },
      GET: async () => {
        try {
          return Response.json(await readRatingPopulation(), { headers: { "cache-control": "no-store" } });
        } catch {
          console.error("rating_population_unavailable");
          return Response.json(
            { error: "rating_population_unavailable" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
