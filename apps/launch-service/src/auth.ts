import { Effect, Result, Schema } from "effect";
import type { MiddlewareHandler } from "hono";
import { normalizeAddress } from "./address";
import { BoundaryDecodeError, IdentityUnavailable } from "./errors";

export interface LauncherIdentity {
  address: string;
}

export interface IdentityResolver {
  resolve(cookie: string): Effect.Effect<LauncherIdentity | null, IdentityUnavailable | BoundaryDecodeError>;
}

export type LaunchAppEnv = { Variables: { launcherAddress: string } };
export interface LaunchAccess {
  allowedOrigins: ReadonlySet<string>;
  launcherAllowlist: ReadonlySet<string>;
}

export const requireIdentity =
  (identity: IdentityResolver, config: LaunchAccess): MiddlewareHandler<LaunchAppEnv> =>
  async (context, next) => {
    if (context.req.method === "GET" || context.req.method === "OPTIONS") return next();
    const origin = context.req.header("origin");
    if (!origin || !config.allowedOrigins.has(origin))
      return context.json({ error: "Launch origin is not allowed." }, 403);
    const cookie = context.req.header("cookie");
    if (!cookie) return context.json({ error: "Authenticated Realms session required." }, 401);
    const result = await Effect.runPromise(Effect.result(identity.resolve(cookie)));
    if (Result.isFailure(result)) return context.json({ error: "Identity service unavailable." }, 503);
    if (!result.success) return context.json({ error: "Authenticated Realms session required." }, 401);
    context.set("launcherAddress", result.success.address);
    return next();
  };

export const requireLauncher =
  (config: LaunchAccess): MiddlewareHandler<LaunchAppEnv> =>
  async (context, next) => {
    if (context.req.method === "GET" || context.req.method === "OPTIONS") return next();
    if (!config.launcherAllowlist.has(context.get("launcherAddress"))) {
      return context.json({ error: "This identity is not allowed to launch games." }, 403);
    }
    return next();
  };

// A launcher or a slot's player is the Starknet wallet linked to the Realms account; an account with no linked wallet
// has no launch identity.
const IdentitySessionSchema = Schema.Struct({
  session: Schema.Struct({ id: Schema.NonEmptyString }),
  user: Schema.Struct({
    address: Schema.optional(Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-fA-F]+$/))))),
  }),
});

/** Asks the identity Worker, over its service binding, whose session a cookie carries. */
export const createIdentityResolver = (
  identityUrl: string,
  fetchSession: (url: URL, init: RequestInit) => Promise<Response>,
): IdentityResolver => ({
  resolve: (cookie) =>
    Effect.tryPromise({
      try: () =>
        fetchSession(new URL("/api/auth/get-session", identityUrl), {
          headers: { accept: "application/json", cookie },
        }),
      catch: (cause) => new IdentityUnavailable({ cause }),
    }).pipe(
      Effect.flatMap((response): Effect.Effect<unknown | null, IdentityUnavailable | BoundaryDecodeError> => {
        if (response.status === 401) return Effect.succeed(null);
        if (!response.ok) return Effect.fail(new IdentityUnavailable({ cause: `status ${response.status}` }));
        return Effect.tryPromise({
          try: () => response.json(),
          catch: (cause) => new BoundaryDecodeError({ boundary: "identity-session-json", cause }),
        });
      }),
      Effect.flatMap((payload) => {
        if (payload === null) return Effect.succeed(null);
        return Schema.decodeUnknownEffect(IdentitySessionSchema)(payload).pipe(
          Effect.map((session) => (session.user.address ? { address: normalizeAddress(session.user.address) } : null)),
          Effect.mapError((cause) => new BoundaryDecodeError({ boundary: "identity-session", cause })),
        );
      }),
    ),
});
