import { Data, Effect, Schema } from "effect";
import { realmsAccountAddress, type DeviceChange } from "@realms-world/identity/account";
import type { Guardian } from "@realms-world/guardian";

import { hasVerifiedSignIn, type IdentityAuth } from "./auth";
import { json } from "./http";
import { recordApprovedAccount } from "./realms-accounts";

const FIELD_PRIME = 2n ** 251n + 17n * 2n ** 192n + 1n;

/** A field element as the account checks it: hex below the prime, so nothing is silently reduced before signing. */
const Felt = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^0x[0-9a-fA-F]{1,64}$/)),
  Schema.check(Schema.makeFilter((value: string) => BigInt(value) < FIELD_PRIME || "must be below the field prime")),
);

const DeviceChangeRequest = Schema.Struct({
  chainId: Felt,
  account: Felt,
  action: Schema.Literals(["ADD", "REVOKE"]),
  deviceKey: Felt,
  counter: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }))),
});

class DeviceRequestError extends Data.TaggedError("DeviceRequestError")<{ code: string; status: number }> {}

interface DeviceChangeDependencies {
  auth: IdentityAuth;
  db: D1Database;
  guardian: Guardian;
  accountClassHash: string;
}

/**
 * POST /api/devices: the guardian's approval for one device change on the caller's own account. The account must be
 * the one the caller's Realms id places on every shard, and the caller must have signed in through Discord or an email
 * code, so no account without a verified way in obtains an approval.
 */
export const handleDeviceChange = (request: Request, dependencies: DeviceChangeDependencies): Promise<Response> =>
  Effect.runPromise(
    approveDeviceChange(request, dependencies).pipe(
      Effect.map((approval) => json(approval)),
      Effect.catchTag("DeviceRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );

const approveDeviceChange = (request: Request, { auth, db, guardian, accountClassHash }: DeviceChangeDependencies) =>
  Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }),
      catch: () => new DeviceRequestError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session) return yield* new DeviceRequestError({ code: "unauthorized", status: 401 });
    const realmsId = session.user.realmsId;
    if (!realmsId) return yield* Effect.die(new Error(`user ${session.user.id} has no Realms id`));
    const change = yield* readDeviceChange(request);
    if (!(yield* Effect.promise(() => hasVerifiedSignIn(db, session.user.id)))) {
      return yield* new DeviceRequestError({ code: "account_not_secured", status: 403 });
    }
    const guardianPublicKey = yield* Effect.promise(() => guardian.publicKey());
    const ownAccount = realmsAccountAddress(realmsId, accountClassHash, guardianPublicKey);
    if (BigInt(change.account) !== BigInt(ownAccount)) {
      return yield* new DeviceRequestError({ code: "not_your_account", status: 403 });
    }
    if (change.action === "ADD" && (yield* isRevokedDevice(db, realmsId, change.deviceKey))) {
      return yield* new DeviceRequestError({ code: "device_revoked", status: 403 });
    }
    const signature = yield* Effect.promise(() => guardian.signDeviceChange(change));
    if (change.action === "ADD") yield* Effect.promise(() => recordApprovedAccount(db, ownAccount, realmsId));
    if (change.action === "REVOKE") yield* recordRevokedDevice(db, realmsId, change.deviceKey);
    return { ...change, signature: [signature.r, signature.s] };
  });

const readDeviceChange = (request: Request) =>
  Effect.tryPromise({ try: () => request.json(), catch: () => undefined }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(DeviceChangeRequest)),
    Effect.map((change): DeviceChange => change),
    Effect.mapError(() => new DeviceRequestError({ code: "invalid_device_change", status: 400 })),
  );

/**
 * A revoked device keeps its session cookie, so the account's approvals, not the client, keep it out: once a key is
 * revoked from a Realms account, no shard's account gets it back.
 */
const isRevokedDevice = (db: D1Database, realmsId: string, deviceKey: string) =>
  Effect.promise(
    async () =>
      (await db
        .prepare('SELECT 1 FROM "revoked_devices" WHERE "realmsId" = ? AND "deviceKey" = ?')
        .bind(realmsId, canonicalFelt(deviceKey))
        .first()) !== null,
  );

const recordRevokedDevice = (db: D1Database, realmsId: string, deviceKey: string) =>
  Effect.promise(() =>
    db
      .prepare(
        'INSERT INTO "revoked_devices" ("realmsId", "deviceKey", "revokedAt") VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      )
      .bind(realmsId, canonicalFelt(deviceKey), Date.now())
      .run(),
  );

const canonicalFelt = (value: string) => `0x${BigInt(value).toString(16)}`;
