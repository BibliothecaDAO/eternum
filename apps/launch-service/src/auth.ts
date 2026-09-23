import { presentsOperatorToken } from "@realms-world/identity";
import { Effect, Result, Schema } from "effect";
import type { MiddlewareHandler } from "hono";
import { normalizeAddress } from "./address";
import { BoundaryDecodeError, IdentityUnavailable } from "./errors";

/**
 * Who a session is: the Realms account, which is the player, and the wallet linked to it, if any, which is how an
 * operator is named on the launcher allowlist.
 */
export interface SessionIdentity {
  realmsId: string;
  wallet: string | null;
}

export interface IdentityResolver {
  resolve(cookie: string): Effect.Effect<SessionIdentity | null, IdentityUnavailable | BoundaryDecodeError>;
}

/**
 * Who is calling: a signed-in Realms account (a player, and a launcher when its linked wallet is allowlisted), or the
 * environment's operator automation, which presents the operator token and has no Realms account.
 */
export type Caller = { kind: "session"; realmsId: string; wallet: string | null } | { kind: "operator" };

export type LaunchAppEnv = { Variables: { caller: Caller } };
export interface LaunchAccess {
  allowedOrigins: ReadonlySet<string>;
  launcherAllowlist: ReadonlySet<string>;
  operatorToken: string;
}

/** Launchers are the operator and allowlisted wallets: one rule for games and for rosters. */
export const isLauncher = (caller: Caller, config: Pick<LaunchAccess, "launcherAllowlist">): boolean =>
  caller.kind === "operator" || (caller.wallet !== null && config.launcherAllowlist.has(caller.wallet));

export const requireIdentity =
  (identity: IdentityResolver, config: LaunchAccess): MiddlewareHandler<LaunchAppEnv> =>
  async (context, next) => {
    if (context.req.method === "GET" || context.req.method === "OPTIONS") return next();
    // A bearer token is operator automation, which runs server-side with no Origin; a browser never sends one on its
    // own, so only the session cookie needs the origin check.
    if (context.req.header("authorization")) {
      if (!(await presentsOperatorToken(context.req.raw, config.operatorToken)))
        return context.json({ error: "Invalid operator token." }, 401);
      context.set("caller", { kind: "operator" });
      return next();
    }
    const origin = context.req.header("origin");
    if (!origin || !config.allowedOrigins.has(origin))
      return context.json({ error: "Launch origin is not allowed." }, 403);
    const cookie = context.req.header("cookie");
    if (!cookie) return context.json({ error: "Authenticated Realms session required." }, 401);
    const result = await Effect.runPromise(Effect.result(identity.resolve(cookie)));
    if (Result.isFailure(result)) return context.json({ error: "Identity service unavailable." }, 503);
    if (!result.success) return context.json({ error: "Authenticated Realms session required." }, 401);
    context.set("caller", { kind: "session", ...result.success });
    return next();
  };

export const requireLauncher =
  (config: LaunchAccess): MiddlewareHandler<LaunchAppEnv> =>
  async (context, next) => {
    if (context.req.method === "GET" || context.req.method === "OPTIONS") return next();
    if (!isLauncher(context.get("caller"), config)) {
      return context.json({ error: "This identity is not allowed to launch games." }, 403);
    }
    return next();
  };

const Hex = Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-fA-F]+$/)));
const IdentitySessionSchema = Schema.Struct({
  session: Schema.Struct({ id: Schema.NonEmptyString }),
  user: Schema.Struct({ realmsId: Hex, address: Schema.optional(Schema.NullOr(Hex)) }),
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
          Effect.map(({ user }) => ({
            realmsId: normalizeAddress(user.realmsId),
            wallet: user.address ? normalizeAddress(user.address) : null,
          })),
          Effect.mapError((cause) => new BoundaryDecodeError({ boundary: "identity-session", cause })),
        );
      }),
    ),
});
