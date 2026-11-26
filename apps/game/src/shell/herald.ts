import {
  fetchHeraldAspectRoster,
  fetchHeraldLeaderboard,
  HeraldHttpError,
  type GameRef,
} from "@bibliothecadao/eternum/shard";
import type { HeraldAspectRace } from "@bibliothecadao/eternum/game-sync";
import { aspects, type AspectId } from "@bibliothecadao/types";
import { realmsAccountAddress } from "@realms-world/identity/account";
import { hashKey, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { appQueryClient } from "@/runtime/query-client";

import {
  canEnterGame,
  fetchDirectory,
  fetchDirectoryHistory,
  isGameNotStarted,
  type DirectoryEntry,
} from "@/runtime/world/directory";
import { requireOpenShard } from "@/runtime/world/shards";
import { fetchApi } from "@/runtime/app-api";

import { archivedSeason } from "./season-tab/archive/archive";

/** A directory entry with the shard it came from, so the shell can address the game as (chain id, game id). */
export interface DirectoryGame extends DirectoryEntry {
  chainId: string;
}

export type AspectSeasonGame = DirectoryGame & { aspect_race: HeraldAspectRace };

export const isAspectSeason = (season: DirectoryGame | null | undefined): season is AspectSeasonGame =>
  season?.aspect_race != null;

/** A directory entry's game identity: its shard's chain id and its id there. */
export const gameRefOf = (game: DirectoryGame): GameRef => ({ chainId: game.chainId, gameId: game.game_id });

interface ShardDirectory {
  /** Live and upcoming games; a settled game lives in the history instead. */
  games: DirectoryGame[];
  confirmedBlock?: number;
}

const DIRECTORY_QUERY_KEY = ["shell", "directory"] as const;

/**
 * Our directory from the Worker, the one list of shards and their games. No shard's Herald is contacted here: a game's
 * shard opens only when the game is entered.
 */
export const fetchDirectories = async (player: string | null): Promise<ShardDirectory> => {
  const shard = await fetchDirectory(player);
  if (!shard?.games) return { games: [] };
  const { chainId } = shard;
  return { games: shard.games.map((game) => ({ ...game, chainId })), confirmedBlock: shard.confirmedBlock };
};

interface GuardianIdentity {
  publicKey: string;
  accountClassHash: string;
}

/** Our guardian's key and the account class: with the Realms id they place the player's account on every shard we run. */
const fetchGuardian = async (): Promise<GuardianIdentity> => {
  const response = await fetchApi("/api/guardian");
  if (!response.ok) throw new Error(`Guardian answered ${response.status}`);
  return (await response.json()) as GuardianIdentity;
};

/**
 * The signed-in player's account address on every shard our directory lists, known from the session alone, before any
 * game is joined: the directory admits only shards whose accounts sit under this guardian and class.
 */
export const realmsPlayerOf = (realmsId: string | undefined, guardian: GuardianIdentity | undefined): string | null => {
  if (!realmsId || !guardian) return null;
  const inputs = `${realmsId}:${guardian.accountClassHash}:${guardian.publicKey}`;
  if (lastRealmsPlayer?.inputs !== inputs)
    lastRealmsPlayer = {
      inputs,
      address: realmsAccountAddress(realmsId, guardian.accountClassHash, guardian.publicKey),
    };
  return lastRealmsPlayer.address;
};

/**
 * The address last worked out, with what it was worked out from. It is a pedersen hash, milliseconds of work, and every
 * HUD render that shows the player asks for it: a press or a fact change paid it again in each surface.
 */
let lastRealmsPlayer: { inputs: string; address: string } | null = null;

export const GUARDIAN_QUERY = {
  queryKey: ["shell", "guardian"],
  queryFn: fetchGuardian,
  staleTime: Infinity,
} as const;

/** Any player's account address on our shards, by their Realms id (chat names players by it): null until the guardian
 * has answered. */
export const useRealmsAccountOf = (): ((realmsId: string) => string | null) => {
  const guardian = useQuery(GUARDIAN_QUERY).data;
  return useCallback((realmsId: string) => realmsPlayerOf(realmsId, guardian), [guardian]);
};

export const useRealmsPlayer = () => {
  const { session } = useIdentitySession();
  const guardian = useQuery({ ...GUARDIAN_QUERY, enabled: session !== null });
  return { ...guardian, data: realmsPlayerOf(session?.user.realmsId, guardian.data) };
};

/** The signed-in player's account address outside React, as `useRealmsPlayer` reads it: null until both have answered. */
export const readRealmsPlayer = (): string | null =>
  realmsPlayerOf(
    useIdentitySessionStore.getState().session?.user.realmsId,
    appQueryClient.getQueryData<GuardianIdentity>(GUARDIAN_QUERY.queryKey),
  );

/** Calls back whenever the signed-in player may have changed: the session, or the guardian, asked once a session exists. */
export const followRealmsPlayer = (onChange: () => void): (() => void) => {
  const askGuardian = () => {
    if (useIdentitySessionStore.getState().session) void appQueryClient.prefetchQuery(GUARDIAN_QUERY);
  };
  askGuardian();
  const guardianHash = hashKey(GUARDIAN_QUERY.queryKey);
  const stopSession = useIdentitySessionStore.subscribe(() => {
    askGuardian();
    onChange();
  });
  const stopGuardian = appQueryClient.getQueryCache().subscribe(({ query }) => {
    if (query.queryHash === guardianHash) onChange();
  });
  return () => {
    stopSession();
    stopGuardian();
  };
};

export const useDirectory = () => {
  const { session } = useIdentitySession();
  const client = useQueryClient();
  const realmsId = session?.user.realmsId ?? null;
  return useQuery({
    queryKey: [...DIRECTORY_QUERY_KEY, realmsId],
    queryFn: async () =>
      fetchDirectories(realmsId ? realmsPlayerOf(realmsId, await client.fetchQuery(GUARDIAN_QUERY)) : null),
    refetchInterval: 15_000,
  });
};

/**
 * The first few settled games, as a short list shows them (the latest result, a player's recent matches). `enabled`
 * holds the read until the player it is for is known, so a list of their own never shows everyone's.
 */
export const useRecentResults = (
  limit: number,
  player: string | null = null,
  enabled = true,
  mode: DirectoryGame["mode"] | null = null,
) =>
  useQuery({
    queryKey: ["shell", "history", "recent", limit, player, mode],
    queryFn: () => fetchDirectoryHistory({ limit, player, mode }),
    enabled,
    staleTime: 30_000,
  });

/** Every settled game on the shards we list, newest first, followed to its last page: where a season that ended lives. */
export const useSettledGames = () =>
  useQuery({
    queryKey: ["shell", "history", "all"],
    queryFn: readHistory,
    staleTime: 60_000,
  });

const HISTORY_PAGE = 100;

const readHistory = async () => {
  const games: Awaited<ReturnType<typeof fetchDirectoryHistory>>["games"] = [];
  let cursor: string | null = null;
  do {
    const page = await fetchDirectoryHistory({ limit: HISTORY_PAGE, cursor });
    games.push(...page.games);
    cursor = page.next ?? null;
  } while (cursor !== null);
  return games;
};

const isAspectOnlyLeaderboard = (error: unknown): boolean =>
  error instanceof HeraldHttpError && error.status === 404 && error.code === "season_one_ranks_aspects";

export const useLeaderboard = (game: GameRef | DirectoryGame | null) => {
  const ref = game === null ? null : "game_id" in game ? (isAspectSeason(game) ? null : gameRefOf(game)) : game;
  const archived = ref ? archivedSeason(ref)?.board : undefined;
  return useQuery({
    queryKey: ["shell", "leaderboard", ref?.chainId, ref?.gameId],
    queryFn: async () => {
      try {
        return await fetchHeraldLeaderboard(await requireOpenShard(ref!.chainId), ref!.gameId);
      } catch (error) {
        if (isAspectOnlyLeaderboard(error)) return null;
        throw error;
      }
    },
    initialData: archived,
    enabled: ref !== null && archived === undefined,
    refetchInterval: 30_000,
  });
};

export const ROSTER_TOP = 10;

const aspectRosterQueryOptions = (ref: GameRef, aspect: AspectId) => ({
  queryKey: ["shell", "aspect-roster", ref.chainId, ref.gameId, aspect] as const,
  queryFn: async () =>
    fetchHeraldAspectRoster(await requireOpenShard(ref.chainId), ref.gameId, aspect, {
      offset: 0,
      limit: ROSTER_TOP,
    }),
  refetchInterval: 30_000,
});

export const useAspectRoster = (ref: GameRef, aspect: AspectId) => useQuery(aspectRosterQueryOptions(ref, aspect));

export const useAllAspectRosters = (ref: GameRef) =>
  useQueries({
    queries: aspects.map(({ id }) => aspectRosterQueryOptions(ref, id)),
  });

const soonest = (games: readonly DirectoryGame[]): DirectoryGame | undefined =>
  games.toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];

/**
 * The game to point the player at: one they can enter now, such as a live Frontier season, else the soonest still
 * taking players.
 */
export const nextOpenGame = (games: readonly DirectoryGame[]): DirectoryGame | undefined =>
  soonest(games.filter(canEnterGame)) ?? soonest(games.filter((game) => !game.error && isGameNotStarted(game)));
