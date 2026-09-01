import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { Context, Effect, Result } from "effect";

import { DISPLAY_NAME_MAX_LENGTH, playerIdSchema } from "@bibliothecadao/types";
import type { BoundaryDecodeError, IdentityUnavailable, PlayerRegistryUnavailable } from "../../effect/errors";
import { BoundaryDecodeError as DecodeError, IdentityUnavailable as IdentityError } from "../../effect/errors";

export interface PlayerSession {
  playerId: string;
  membershipPlayerId: string | null;
  displayName?: string;
  aliases: string[];
}

export type AppEnv = {
  Variables: {
    playerSession?: PlayerSession;
  };
};

export interface SessionResolver {
  resolve(
    cookie: string,
  ): Effect.Effect<PlayerSession | null, IdentityUnavailable | BoundaryDecodeError | PlayerRegistryUnavailable>;
}

export class VerifiedIdentity extends Context.Service<VerifiedIdentity, SessionResolver>()("chat/VerifiedIdentity") {}

type SessionFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type IdentitySession = z.infer<typeof identitySessionSchema>;

const identitySessionSchema = z.object({
  session: z.object({ id: z.string().min(1) }),
  user: z.object({ id: playerIdSchema, name: z.string().optional().nullable() }),
});

const normalizePlayerId = (playerId: string): string => {
  try {
    return `0x${BigInt(playerId).toString(16)}`;
  } catch {
    return playerId;
  }
};

const fetchIdentitySession = (
  identityUrl: string,
  cookie: string,
  fetchSession: SessionFetch,
): Effect.Effect<unknown | null, IdentityUnavailable | BoundaryDecodeError> =>
  Effect.tryPromise({
    try: () =>
      fetchSession(new URL("/api/auth/get-session", identityUrl), {
        headers: { accept: "application/json", cookie },
      }),
    catch: (cause) => new IdentityError({ cause }),
  }).pipe(
    Effect.flatMap((response): Effect.Effect<unknown | null, IdentityUnavailable | BoundaryDecodeError> => {
      if (response.status === 401) return Effect.succeed(null);
      if (!response.ok) return Effect.fail(new IdentityError({ cause: `status ${response.status}` }));
      return Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => new DecodeError({ boundary: "identity-session", cause }),
      });
    }),
  );

const decodeIdentitySession = (payload: unknown | null): Effect.Effect<IdentitySession | null, BoundaryDecodeError> => {
  if (payload === null) return Effect.succeed(null);
  const result = identitySessionSchema.safeParse(payload);
  return result.success
    ? Effect.succeed(result.data)
    : Effect.fail(new DecodeError({ boundary: "identity-session", cause: result.error }));
};

export const createIdentitySessionResolver = ({
  identityUrl,
  resolveMembershipPlayer,
  fetch: fetchSession = globalThis.fetch,
  ttlMs = 5_000,
  maxEntries = 1_000,
}: {
  identityUrl: string;
  resolveMembershipPlayer: (
    owner: string,
  ) => Effect.Effect<string | null, BoundaryDecodeError | PlayerRegistryUnavailable>;
  fetch?: SessionFetch;
  ttlMs?: number;
  maxEntries?: number;
}): SessionResolver => {
  const cache = new Map<string, { expiresAt: number; session: PlayerSession }>();

  return {
    resolve: (cookie) => {
      const cached = cache.get(cookie);
      if (cached && cached.expiresAt > Date.now()) return Effect.succeed(cached.session);
      cache.delete(cookie);

      return fetchIdentitySession(identityUrl, cookie, fetchSession).pipe(
        Effect.flatMap(decodeIdentitySession),
        Effect.flatMap((identity) => {
          if (!identity) return Effect.succeed<PlayerSession | null>(null);
          const playerId = normalizePlayerId(identity.user.id);
          const displayName = identity.user.name?.trim().slice(0, DISPLAY_NAME_MAX_LENGTH) || undefined;
          return resolveMembershipPlayer(playerId).pipe(
            Effect.map((membershipPlayerId) => ({ playerId, membershipPlayerId, displayName, aliases: [playerId] })),
          );
        }),
        Effect.tap((session) =>
          Effect.sync(() => {
            if (!session) return;
            if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
            cache.set(cookie, { expiresAt: Date.now() + ttlMs, session });
          }),
        ),
      );
    },
  };
};

export const createAttachPlayerSession =
  (resolver: SessionResolver): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const cookie = c.req.header("cookie");
    if (cookie) {
      const result = await Effect.runPromise(Effect.result(resolver.resolve(cookie)));
      if (Result.isSuccess(result) && result.success) c.set("playerSession", result.success);
    }
    await next();
  };

export const requirePlayerSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  if (!c.get("playerSession")) {
    return c.json({ error: "Authenticated Realms session required." }, 401);
  }

  await next();
};
