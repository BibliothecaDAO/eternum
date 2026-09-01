import { z } from "zod";
import { Context, Effect } from "effect";

import { gameChannelId } from "./channel";
import { BoundaryDecodeError, HeraldUnavailable } from "../effect/errors";

// Herald's directory folds GameRegistry + WorldConfig, and derives player_state
// from BlitzSettlement + Structure. Chat never accepts membership from clients.
export const HERALD_GAME_MEMBERSHIP_MODELS = ["GameRegistry", "WorldConfig", "BlitzSettlement", "Structure"] as const;

const directorySchema = z.object({
  games: z.array(
    z.object({
      game_id: z.number().int().positive(),
      mode: z.string().nullable(),
      status: z.enum(["Created", "Registration", "Live", "Ended", "Settled"]),
      player_state: z.object({ registered: z.boolean(), settled: z.boolean() }).nullable().optional(),
    }),
  ),
});

export interface MembershipResolver {
  channelsForPlayer(playerId: string): Effect.Effect<ReadonlySet<string>, HeraldUnavailable | BoundaryDecodeError>;
  isMember(playerId: string, channelId: string): Effect.Effect<boolean, HeraldUnavailable | BoundaryDecodeError>;
}

export class ChannelMembership extends Context.Tag("chat/ChannelMembership")<ChannelMembership, MembershipResolver>() {}

type DirectoryFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export const createHeraldMembershipResolver = ({
  heraldUrl,
  chain = "madara",
  fetch: fetchDirectory = globalThis.fetch,
  ttlMs = 5_000,
  maxEntries = 5_000,
}: {
  heraldUrl: string;
  chain?: string;
  fetch?: DirectoryFetch;
  ttlMs?: number;
  maxEntries?: number;
}): MembershipResolver => {
  const cache = new Map<string, { expiresAt: number; channels: ReadonlySet<string> }>();

  const channelsForPlayer = (
    playerId: string,
  ): Effect.Effect<ReadonlySet<string>, HeraldUnavailable | BoundaryDecodeError> => {
    const cached = cache.get(playerId);
    if (cached && cached.expiresAt > Date.now()) return Effect.succeed(cached.channels);
    cache.delete(playerId);

    const url = new URL(`/${chain}/games`, heraldUrl);
    url.searchParams.set("player", playerId);
    return Effect.tryPromise({
      try: () => fetchDirectory(url, { headers: { accept: "application/json" } }),
      catch: (cause) => new HeraldUnavailable({ cause }),
    }).pipe(
      Effect.filterOrFail(
        (response) => response.ok,
        (response) => new HeraldUnavailable({ cause: `status ${response.status}` }),
      ),
      Effect.flatMap((response) =>
        Effect.tryPromise({
          try: () => response.json(),
          catch: (cause) => new BoundaryDecodeError({ boundary: "herald-game-directory", cause }),
        }),
      ),
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => directorySchema.parse(payload),
          catch: (cause) => new BoundaryDecodeError({ boundary: "herald-game-directory", cause }),
        }),
      ),
      Effect.map(
        (directory) =>
          new Set(
            directory.games
              .filter(
                (game) =>
                  game.mode?.toLowerCase() === "blitz" &&
                  (game.status === "Registration" || game.status === "Live") &&
                  Boolean(game.player_state?.registered || game.player_state?.settled),
              )
              .map((game) => gameChannelId(game.game_id)),
          ),
      ),
      Effect.tap((channels) =>
        Effect.sync(() => {
          if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
          cache.set(playerId, { expiresAt: Date.now() + ttlMs, channels });
        }),
      ),
    );
  };

  return {
    channelsForPlayer,
    isMember: (playerId, channelId) =>
      channelsForPlayer(playerId).pipe(Effect.map((channels) => channels.has(channelId))),
  };
};
