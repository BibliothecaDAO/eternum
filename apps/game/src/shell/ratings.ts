import { useQuery } from "@tanstack/react-query";

import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { fetchApi } from "@/runtime/app-api";

/**
 * The Blitz rating (MMR), read from the identity service's /api/ratings (lobby-chat-mmr.txt): the token's current
 * rating, pinned to one mainnet block per answer. The app keeps no rating of its own; every read asks again.
 */
type RatingAnswer =
  | { status: "rated"; player: string; rating: string }
  | { status: "unlinked" | "unknown_identity"; player: null; rating: null };

interface RatingsResponse {
  block_number: number | null;
  block_hash: string | null;
  ratings: Record<string, RatingAnswer>;
}

interface RatingTopResponse {
  block_number: number;
  block_hash: string;
  total: number;
  entries: { rank: number; player: string; rating: string }[];
  self: null | (RatingAnswer & { rank: number | null });
}

const readJson = async <T>(path: string): Promise<T> => {
  const response = await fetchApi(path);
  if (!response.ok) throw new Error(`Ratings answered ${response.status}`);
  return (await response.json()) as T;
};

/** The rating's top rows, and the reader's own rating and rank when a Realms id is given. */
export const useRatingTop = (limit: number, realmsId: string | null) =>
  useQuery({
    queryKey: ["shell", "ratings", "top", limit, realmsId],
    queryFn: () =>
      readJson<RatingTopResponse>(
        `/api/ratings/top?limit=${limit}${realmsId ? `&realmsId=${encodeURIComponent(realmsId)}` : ""}`,
      ),
    staleTime: 0,
    retry: 1,
  });

/** Each Realms account's rating, keyed by its Realms id as sent; a player with no linked wallet answers unlinked. */
export const useRatings = (realmsIds: readonly string[]) =>
  useQuery({
    queryKey: ["shell", "ratings", "players", ...realmsIds],
    queryFn: () => readJson<RatingsResponse>(`/api/ratings?realmsIds=${realmsIds.join(",")}`),
    enabled: realmsIds.length > 0,
    staleTime: 0,
    retry: 1,
  });

/** A rating as the screens show it: whole points (the service answers exact decimals; the fraction is dropped). */
export const ratingPoints = (rating: string): number => Number(rating.split(".")[0]);

/** The game's six tiers, highest first, each from its floor in rating points (the earlier client's mmr-tiers). */
const TIERS = [
  { name: "Storm Lord", floor: 2400, mark: "R1" },
  { name: "Warlord", floor: 2000, mark: "R2" },
  { name: "Conqueror", floor: 1600, mark: "R3" },
  { name: "Marauder", floor: 1200, mark: "R4" },
  { name: "Raider", floor: 600, mark: "R5" },
  { name: "Scrapper", floor: 0, mark: "R6" },
] as const satisfies readonly { name: string; floor: number; mark: IconCode }[];

type RatingTier = (typeof TIERS)[number];

// Scrapper's floor is 0 and a rating is never negative, so every rating has a tier.
export const tierOf = (points: number): RatingTier => TIERS.find((tier) => points >= tier.floor)!;
