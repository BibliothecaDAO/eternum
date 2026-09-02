import { Context, Effect, Layer, Schema } from "effect";
import { normalizeAddress } from "./address";
import { BoundaryDecodeError, IdentityUnavailable } from "./errors";

export interface LauncherIdentity {
  address: string;
}

export interface IdentityResolver {
  resolve(cookie: string): Effect.Effect<LauncherIdentity | null, IdentityUnavailable | BoundaryDecodeError>;
}

export class VerifiedIdentity extends Context.Service<VerifiedIdentity, IdentityResolver>()(
  "launch/VerifiedIdentity",
) {}

const IdentitySessionSchema = Schema.Struct({
  session: Schema.Struct({ id: Schema.NonEmptyString }),
  user: Schema.Struct({ id: Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-fA-F]+$/))) }),
});

export const createIdentityResolver = (
  identityUrl: string,
  fetchSession: typeof fetch = globalThis.fetch,
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
          Effect.map((session) => ({ address: normalizeAddress(session.user.id) })),
          Effect.mapError((cause) => new BoundaryDecodeError({ boundary: "identity-session", cause })),
        );
      }),
    ),
});

export const identityLayer = (identityUrl: string): Layer.Layer<VerifiedIdentity> =>
  Layer.succeed(VerifiedIdentity, createIdentityResolver(identityUrl));
