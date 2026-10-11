import { Effect, Data, Schema } from "effect";
import { MAX_LABOR_REALMS, type LaborClaim, type LaborClaimResult, type RelayEffect } from "./ports";

const LaborRealm = Schema.Struct({
  gameId: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 0xffffffff }))),
  realmId: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 8000 }))),
  home: Schema.String.pipe(Schema.check(Schema.isPattern(/^(0x[0-9a-fA-F]{1,16}|[0-9]{1,20})$/))),
});
const LaborRequest = Schema.Struct({
  realms: Schema.Array(LaborRealm).pipe(
    Schema.check(Schema.makeFilter((rows) => rows.length > 0 && rows.length <= MAX_LABOR_REALMS)),
  ),
});
class LaborRequestError extends Data.TaggedError("LaborRequestError")<{ status: number; code: string }> {}
interface LaborRoute {
  origin: string;
  chainId: string;
  authenticate(cookie: string): Promise<{ realmsId: string } | null>;
  accountForRealmsId(id: string): Promise<string | null>;
  currentDay(): RelayEffect<number>;
  grant(claim: LaborClaim): Promise<LaborClaimResult>;
}

export const handleLaborRequest = (request: Request, dependencies: LaborRoute): Promise<Response> =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (request.headers.get("origin") !== new URL(dependencies.origin).origin)
        return yield* Effect.fail(new LaborRequestError({ status: 403, code: "invalid_origin" }));
      const identity = yield* Effect.tryPromise({
        try: () => dependencies.authenticate(request.headers.get("cookie") ?? ""),
        catch: () => new LaborRequestError({ status: 503, code: "authentication_unavailable" }),
      });
      if (!identity) return yield* Effect.fail(new LaborRequestError({ status: 401, code: "unauthorized" }));
      const body = yield* Effect.tryPromise({ try: () => request.json(), catch: () => undefined }).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(LaborRequest, { onExcessProperty: "error" })),
        Effect.mapError(() => new LaborRequestError({ status: 400, code: "invalid_labor_request" })),
      );
      const realms = body.realms;
      const account = yield* Effect.tryPromise({
        try: () => dependencies.accountForRealmsId(identity.realmsId),
        catch: () => new LaborRequestError({ status: 503, code: "account_unavailable" }),
      });
      if (!account) return yield* Effect.fail(new LaborRequestError({ status: 403, code: "account_unavailable" }));
      if (realms.some((realm) => BigInt(realm.home) === 0n || BigInt(realm.home) > 0xffffffffffffffffn))
        return yield* Effect.fail(new LaborRequestError({ status: 400, code: "unsupported_home_width" }));
      if (new Set(realms.map((realm) => realm.realmId)).size !== realms.length)
        return yield* Effect.fail(new LaborRequestError({ status: 400, code: "invalid_labor_request" }));
      const day = yield* dependencies.currentDay();
      const result = yield* Effect.tryPromise({
        try: () =>
          dependencies.grant({
            chainId: dependencies.chainId,
            realms: realms.map((realm) => ({ ...realm, realmId: String(realm.realmId) })),
            day,
            realmsId: identity.realmsId,
            account,
          }),
        catch: () => new LaborRequestError({ status: 409, code: "labor_grant_refused" }),
      });
      return Response.json(
        { day, ...result, ...(result.grants.length ? {} : { error: "realm_not_owned" }) },
        { status: result.grants.length ? 200 : 409, headers: { "cache-control": "no-store" } },
      );
    }).pipe(
      Effect.catchTag("LaborRequestError", (error) =>
        Effect.succeed(Response.json({ error: error.code }, { status: error.status })),
      ),
      Effect.catchTag("RelayFailure", (error) =>
        Effect.succeed(Response.json({ error: error.operation }, { status: 503 })),
      ),
    ),
  );
