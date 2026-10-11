import { useQuery } from "@tanstack/react-query";

import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { fetchApi } from "@/runtime/app-api";

/**
 * The Blitz rating (MMR), read from the identity service's /api/ratings: a wallet's current rating on the ledger, pinned
 * to one confirmed L2 block per answer. A rating belongs to the wallet that played, never to an account's current
 * link. The app keeps no rating of its own; every read asks again.
 */
type RatingAnswer = { status: "rated"; player: string; rating: string };

interface RatingsResponse {
  block_number: number | null;
  block_hash: string | null;
  ratings: Record<string, RatingAnswer>;
}

/**
 * Who stands behind a rated wallet, presentation only: the owner's Realms identity, or null when none is known. A null
 * name (no name chosen) and a null profile both draw the owner as an address.
 */
export type RatingProfile = { realmsId: string; name: string | null; portrait: string | null } | null;

interface RatingTopResponse {
  block_number: number;
  block_hash: string;
  total: number;
  entries: { rank: number; player: string; rating: string; profile: RatingProfile }[];
  self: null | { status: "rated"; player: string; rating: string; rank: number | null; profile: RatingProfile };
}

const readJson = async <T>(path: string): Promise<T> => {
  const response = await fetchApi(path);
  if (!response.ok) throw new Error(`Ratings answered ${response.status}`);
  return (await response.json()) as T;
};

/** The rating's top rows, and the reader's own rating and rank when their wallet is given. */
export const useRatingTop = (limit: number, wallet: string | null) =>
  useQuery({
    queryKey: ["shell", "ratings", "top", limit, wallet],
    queryFn: () => readJson<RatingTopResponse>(`/api/ratings/top?limit=${limit}${wallet ? `&player=${wallet}` : ""}`),
    staleTime: 0,
    retry: 1,
  });

/** Each wallet's rating, keyed by the wallet as sent. */
export const useRatings = (wallets: readonly string[]) =>
  useQuery({
    queryKey: ["shell", "ratings", "players", ...wallets],
    queryFn: () => readJson<RatingsResponse>(`/api/ratings?players=${wallets.join(",")}`),
    enabled: wallets.length > 0,
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
