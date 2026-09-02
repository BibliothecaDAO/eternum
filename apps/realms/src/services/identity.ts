import { Context, Effect, Layer, Schema, SubscriptionRef } from "effect";
import type { TypedData } from "starknet";
import { buildSiwsMessage } from "@realms-world/identity";

import { env } from "@/env";
import { decodeBoundary } from "./platform/decode";
import type { BoundaryDecodeError } from "./platform/errors";
import { IdentityUnreachable, NameInvalid, NameTaken, Unauthorized, WalletNotConnected } from "./platform/errors";
import { requestJson } from "./platform/http";
import { Wallet } from "./platform/wallet";

/**
 * Identity facts: the better-auth session, SIWS sign-in, display names and the
 * leaderboard population. Served by this app's own server under /api — same
 * origin, cookie-based.
 */

const SessionUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  address: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
});

const SessionPayload = Schema.NullOr(Schema.Struct({ user: SessionUser }));

export interface IdentitySession {
  readonly address: string;
  readonly name: string;
  readonly hasChosenName: boolean;
  readonly portrait: string | null;
}

const NamesPayload = Schema.Struct({
  names: Schema.Record(Schema.String, Schema.String),
});

const PopulationPayload = Schema.Struct({
  players: Schema.Array(
    Schema.Struct({
      address: Schema.String,
      name: Schema.NullOr(Schema.String),
      portrait: Schema.NullOr(Schema.String),
      games: Schema.Number,
    }),
  ),
});

const BindingPayload = Schema.Struct({ account: Schema.NullOr(Schema.String) });

const toSession = (payload: typeof SessionPayload.Type): IdentitySession | null => {
  if (!payload) return null;
  const address = payload.user.address ?? payload.user.id;
  return {
    address,
    name: payload.user.name,
    hasChosenName: payload.user.name.toLowerCase() !== address.toLowerCase(),
    portrait: payload.user.image,
  };
};

const makeIdentityApi = Effect.gen(function* () {
  const wallet = yield* Wallet;

  const api = <A>(input: {
    path: string;
    schema: Schema.ConstraintDecoder<A, never>;
    method?: "GET" | "POST";
    body?: unknown;
  }) =>
    requestJson(input.path, {
      method: input.method ?? "GET",
      credentials: "include",
      ...(input.body !== undefined
        ? { body: JSON.stringify(input.body), headers: { "content-type": "application/json" } }
        : {}),
    }).pipe(
      Effect.mapError((cause) => new IdentityUnreachable({ path: input.path, cause })),
      Effect.filterOrFail(
        (response) => response.status === 200,
        (response) => new IdentityUnreachable({ path: input.path, cause: `status ${response.status}` }),
      ),
      Effect.flatMap((response) => decodeBoundary(`identity:${input.path}`, input.schema)(response.body)),
    );

  const session = api({ path: "/api/auth/get-session", schema: SessionPayload }).pipe(Effect.map(toSession));

  // The SIWS loop from packages/identity, spelled out so wallet signing keeps
  // its typed error channel: nonce → build message → sign → verify → session.
  const signIn = Effect.gen(function* () {
    const connected = yield* SubscriptionRef.get(wallet.session);
    if (!connected) return yield* new WalletNotConnected();

    const { nonce } = yield* api({
      path: "/api/auth/siws/nonce",
      method: "POST",
      body: { address: connected.address },
      schema: Schema.Struct({ nonce: Schema.String }),
    });

    const message = buildSiwsMessage({
      address: connected.address,
      chainId: "SN_MAIN",
      domain: env.VITE_BASE_URL,
      uri: env.VITE_BASE_URL,
      nonce,
    });
    const signature = yield* wallet.signTypedData(message as unknown as TypedData);

    yield* api({
      path: "/api/auth/siws/verify",
      method: "POST",
      body: { address: connected.address, message: JSON.stringify(message), signature },
      schema: Schema.Struct({ token: Schema.String }),
    });

    const established = yield* session;
    if (!established) return yield* new Unauthorized();
    return established;
  });

  const signOut = api({
    path: "/api/auth/sign-out",
    method: "POST",
    body: {},
    schema: Schema.Unknown,
  }).pipe(Effect.asVoid);

  // Better-auth surfaces our name-rule rejections as 422 with a coded message.
  const updateUser = (body: { name?: string; image?: string }) =>
    requestJson("/api/auth/update-user", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }).pipe(
      Effect.mapError((cause) => new IdentityUnreachable({ path: "/api/auth/update-user", cause })),
      Effect.flatMap((response): Effect.Effect<void, IdentityUnreachable | Unauthorized | NameTaken | NameInvalid> => {
        if (response.status === 200) return Effect.void;
        const message =
          typeof response.body === "object" && response.body !== null
            ? String((response.body as { message?: unknown }).message ?? "")
            : "";
        if (body.name !== undefined && message.startsWith("NAME_TAKEN")) {
          return Effect.fail(new NameTaken({ name: body.name }));
        }
        if (body.name !== undefined && message.startsWith("NAME_INVALID")) {
          return Effect.fail(new NameInvalid({ name: body.name, reason: message.slice("NAME_INVALID:".length) }));
        }
        if (response.status === 401) return Effect.fail(new Unauthorized());
        return Effect.fail(
          new IdentityUnreachable({ path: "/api/auth/update-user", cause: `status ${response.status}` }),
        );
      }),
    );

  const claimName = (name: string) => updateUser({ name });
  const setPortrait = (portrait: string) => updateUser({ image: portrait });

  const names = (owners: readonly string[]) =>
    api({
      path: `/api/names?owners=${owners.join(",")}`,
      schema: NamesPayload,
    }).pipe(Effect.map((payload) => payload.names));

  const leaderboardPopulation = api({ path: "/api/leaderboard", schema: PopulationPayload }).pipe(
    Effect.map((payload) => payload.players),
  );

  // 401 means "no session" here, which renders the same as "not bound yet".
  const gameplayBinding = requestJson("/api/gameplay-account", { credentials: "include" }).pipe(
    Effect.mapError((cause) => new IdentityUnreachable({ path: "/api/gameplay-account", cause })),
    Effect.flatMap((response): Effect.Effect<string | null, IdentityUnreachable | BoundaryDecodeError> => {
      if (response.status === 401) return Effect.succeed<string | null>(null);
      if (response.status !== 200) {
        return Effect.fail(
          new IdentityUnreachable({ path: "/api/gameplay-account", cause: `status ${response.status}` }),
        );
      }
      return decodeBoundary(
        "identity:/api/gameplay-account",
        BindingPayload,
      )(response.body).pipe(Effect.map((payload): string | null => payload.account));
    }),
  );

  return { session, signIn, signOut, claimName, setPortrait, names, leaderboardPopulation, gameplayBinding };
});

type IdentityApiShape = Effect.Success<typeof makeIdentityApi>;

export class IdentityApi extends Context.Service<IdentityApi, IdentityApiShape>()("IdentityApi") {
  static readonly layerWithoutDependencies = Layer.effect(IdentityApi, makeIdentityApi);
  static readonly layer = this.layerWithoutDependencies.pipe(Layer.provide(Wallet.layer));
}
