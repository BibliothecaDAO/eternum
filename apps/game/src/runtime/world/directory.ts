import type { HeraldGameDirectoryEntry, ShardManifest } from "@bibliothecadao/eternum/game-sync";
import { fetchApi } from "@/runtime/app-api";

/** A shard game whose launch records may temporarily be unavailable. */
export interface DirectoryEntry extends HeraldGameDirectoryEntry {
  error?: "unavailable";
}

/** One shard as our directory lists it; `games` and `manifest` are null when the Worker could not read that shard. */
export interface DirectoryShard {
  url: string;
  chainId: string;
  games: DirectoryEntry[] | null;
  /** The shard's manifest, which the app opens it from without asking the shard again. */
  manifest: ShardManifest | null;
  error?: "unavailable";
}

export const fetchDirectory = async (player: string | null = null): Promise<DirectoryShard | null> => {
  const query = player ? `?player=${encodeURIComponent(player)}` : "";
  const response = await fetchApi(`/api/directory${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Directory answered ${response.status}`);
  const { shard } = (await response.json()) as { shard: DirectoryShard | null };
  return shard;
};

/** Over at Herald's chain clock: ended, or settled with its recorded result. */
export const isGameOver = (game: HeraldGameDirectoryEntry): boolean =>
  game.status === "Ended" || game.status === "Settled";

export const canEnterGame = (game: DirectoryEntry): boolean =>
  !game.error && !isGameOver(game) && game.mode === "frontier";

/** A finished game in our history, with the shard it lives on. */
interface HistoryGame extends DirectoryEntry {
  chainId: string;
  shardUrl: string;
}

interface DirectoryHistoryPage {
  games: HistoryGame[];
  /** Opaque cursor for the next page; null on the last one. */
  next: string | null;
  /** Listed shards that could not answer for this page, by URL. */
  failures: { url: string; error: "unavailable" }[];
}

/**
 * Our history: every settled game on the shards we list, newest first, a page at a time. With a player, only the
 * games that player took part in.
 */
export const fetchDirectoryHistory = async ({
  limit,
  cursor = null,
  player = null,
}: {
  limit: number;
  cursor?: string | null;
  player?: string | null;
}): Promise<DirectoryHistoryPage> => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set("cursor", cursor);
  if (player) query.set("player", player);
  const response = await fetchApi(`/api/directory/history?${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`History answered ${response.status}`);
  return (await response.json()) as DirectoryHistoryPage;
};
