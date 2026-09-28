import { fetchHeraldLeaderboard, type GameRef, type Shard } from "@bibliothecadao/eternum/shard";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { useIdentitySession } from "@/hooks/context/identity-session";

import {
  canEnterGame,
  fetchDirectory,
  fetchDirectoryHistory,
  type DirectoryShard,
  type DirectoryEntry,
} from "@/runtime/world/directory";
import { readShardDirectory } from "@/runtime/world/shard-directory";
import { listPastedShards, openPastedShards, requireOpenShard } from "@/runtime/world/shards";

/** A directory entry with the shard it came from, so the shell can address the game as (chain id, game id). */
export interface DirectoryGame extends DirectoryEntry {
  chainId: string;
}

/** A shard the shell shows: one our directory lists, or one the player pasted. */
interface ShardListing {
  url: string;
  chainId: string;
  status: "active" | "draining" | "pasted";
  available: boolean;
}

interface ShardDirectory {
  /** Live and upcoming games; a settled game lives in the history instead. */
  games: DirectoryGame[];
  /** Settled games on the shards the player pasted, which our history does not list. */
  pastedFinished: DirectoryGame[];
  shards: ShardListing[];
  /** Shards known but not readable, by URL and reason: the directory's own, and pasted ones that would not open. */
  failures: { url: string; error: Error }[];
}

export const DIRECTORY_QUERY_KEY = ["shell", "directory"] as const;

/**
 * Our directory from the Worker (its games, its caching, its per-shard partial failures), plus the directories of the
 * shards the player pasted, read from those shards themselves since our directory does not list them. No listed
 * shard's Herald is contacted here: a game's shard opens only when the game is entered.
 */
export const fetchDirectories = async (player: string | null): Promise<ShardDirectory> => {
  const [listing, pastedFailures] = await Promise.all([fetchDirectory(player), openPastedShards()]);
  const listed = listing.filter(
    (shard): shard is DirectoryShard & { status: "active" | "draining" } => shard.status !== "retired",
  );
  const pasted = listPastedShards().filter((shard) => !listed.some((entry) => entry.url === shard.url));
  const { games: pastedGames, failures: readFailures } = await readPastedDirectories(pasted, player);
  return {
    games: [
      ...listed.flatMap((shard) => (shard.games ?? []).map((game) => ({ ...game, chainId: shard.chainId }))),
      ...pastedGames.filter((game) => !isSettled(game)),
    ],
    pastedFinished: pastedGames.filter(isSettled).toSorted((a, b) => b.clock.end_at - a.clock.end_at),
    shards: [
      ...listed.map((shard) => ({
        url: shard.url,
        chainId: shard.chainId,
        status: shard.status,
        available: shard.games !== null,
      })),
      ...pasted.map((shard) => ({
        url: shard.url,
        chainId: shard.chainId,
        status: "pasted" as const,
        available: !readFailures.some((failure) => failure.url === shard.url),
      })),
    ],
    failures: [
      ...listed
        .filter((shard) => shard.games === null)
        .map((shard) => ({ url: shard.url, error: new Error("unavailable right now") })),
      ...pastedFailures,
      ...readFailures,
    ],
  };
};

/** One unreadable pasted Herald contributes a failure, while every healthy sibling still contributes its games. */
const readPastedDirectories = async (pasted: readonly Shard[], player: string | null) => {
  const pastedDirectories = await Promise.allSettled(
    pasted.map((shard) => readShardDirectory(shard.chainId, player).then((directory) => ({ shard, directory }))),
  );
  const readFailures = pastedDirectories.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            url: pasted[index].url,
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
          },
        ]
      : [],
  );
  const pastedGames = pastedDirectories.flatMap((result) =>
    result.status === "fulfilled"
      ? result.value.directory.games.map((game) => ({ ...game, chainId: result.value.shard.chainId }))
      : [],
  );
  return { games: pastedGames, failures: readFailures };
};

interface GuardianIdentity {
  publicKey: string;
  accountClassHash: string;
}

/** Our guardian's key and the account class: with the Realms id they place the player's account on every shard we run. */
const fetchGuardian = async (): Promise<GuardianIdentity> => {
  const response = await fetch("/api/guardian");
  if (!response.ok) throw new Error(`Guardian answered ${response.status}`);
  return (await response.json()) as GuardianIdentity;
};

/**
 * The signed-in player's account address on every shard our directory lists, known from the session alone, before any
 * game is joined: the directory admits only shards whose accounts sit under this guardian and class.
 */
export const realmsPlayerOf = (realmsId: string | undefined, guardian: GuardianIdentity | undefined): string | null =>
  realmsId && guardian ? realmsAccountAddress(realmsId, guardian.accountClassHash, guardian.publicKey) : null;

const GUARDIAN_QUERY = { queryKey: ["shell", "guardian"], queryFn: fetchGuardian, staleTime: Infinity } as const;

export const useRealmsPlayer = () => {
  const { session } = useIdentitySession();
  const guardian = useQuery({ ...GUARDIAN_QUERY, enabled: session !== null });
  return { ...guardian, data: realmsPlayerOf(session?.user.realmsId, guardian.data) };
};

/**
 * Every listed and pasted shard's games, for the signed-in player when there is one: each game then says whether the
 * player is in it. The read waits for the session, and a signed-in player's waits for their account address, so no
 * screen of theirs ever reads the anonymous directory in between and mistakes it for their own.
 */
export const useDirectory = () => {
  const { status, session } = useIdentitySession();
  const client = useQueryClient();
  const realmsId = session?.user.realmsId ?? null;
  return useQuery({
    queryKey: [...DIRECTORY_QUERY_KEY, realmsId],
    queryFn: async () =>
      fetchDirectories(realmsId ? realmsPlayerOf(realmsId, await client.fetchQuery(GUARDIAN_QUERY)) : null),
    enabled: status !== "loading",
    refetchInterval: 15_000,
    retry: 1,
  });
};

const HISTORY_PAGE_SIZE = 20;

/** Settled games on our shards, newest first, a page at a time; with a player, only that player's games. */
export const useHistory = (player: string | null = null) =>
  useInfiniteQuery({
    queryKey: ["shell", "history", player],
    queryFn: ({ pageParam }) => fetchDirectoryHistory({ limit: HISTORY_PAGE_SIZE, cursor: pageParam, player }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next,
    staleTime: 30_000,
    retry: 1,
  });

/** The first few settled games, as a short list shows them (the latest result, a player's recent matches). */
export const useRecentResults = (limit: number, player: string | null = null) =>
  useQuery({
    queryKey: ["shell", "history", "recent", limit, player],
    queryFn: () => fetchDirectoryHistory({ limit, player }),
    staleTime: 30_000,
    retry: 1,
  });

/**
 * A game's standings in its mode's shape: Frontier's season board, or live points while a game runs and the recorded
 * final standings once its result is complete.
 */
export const useLeaderboard = (game: GameRef | null) =>
  useQuery({
    queryKey: ["shell", "leaderboard", game?.chainId, game?.gameId],
    queryFn: async () =>
      fetchHeraldLeaderboard(await requireOpenShard((game as GameRef).chainId), (game as GameRef).gameId),
    enabled: game !== null,
    refetchInterval: 30_000,
    retry: 1,
  });

const OPEN_STATUSES = new Set(["Created", "Registration"]);

const soonest = (games: readonly DirectoryGame[]): DirectoryGame | undefined =>
  games.toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];

/**
 * The game to point the player at: one they can enter now, such as a live Frontier season, else the soonest still
 * taking players.
 */
export const nextOpenGame = (games: readonly DirectoryGame[]): DirectoryGame | undefined =>
  soonest(games.filter(canEnterGame)) ?? soonest(games.filter((game) => !game.error && OPEN_STATUSES.has(game.status)));

/** A settled game has its recorded result and belongs to the history, not the game list. */
const isSettled = (game: DirectoryGame): boolean => game.status === "Settled";
