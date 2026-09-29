import { Data, Effect, Schema } from "effect";
import { botRealmsId, realmsAccountAddress, type DeviceChange } from "@realms-world/identity/account";
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
      try: () => auth.api.getSession({ headers: request.headers }),
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
    if (change.action === "ADD") {
      yield* Effect.promise(() => recordApprovedAccount(db, ownAccount, realmsId));
      yield* recordDeviceSession(db, realmsId, change.deviceKey, session.session.id);
    }
    if (change.action === "REVOKE") yield* removeDevice(db, realmsId, change.deviceKey);
    return { ...change, signature: [signature.r, signature.s] };
  });

const BotDeviceRequest = Schema.Struct({
  label: Felt,
  chainId: Felt,
  account: Felt,
  action: Schema.Literals(["ADD", "REVOKE"]),
  deviceKey: Felt,
  counter: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }))),
});

/**
 * POST /api/devices/bots (operator token): the guardian's approval for a bot account's first device, so bots enrol
 * through the same guardian as players. The account must be the one the bot's label places on every shard, and a bot's
 * Realms id is domain-separated from every player's, so the token never approves a device on a player's account. Only
 * the first device (ADD at counter 1) is approved, never a later ADD or a REVOKE: an account accepts a change only at
 * its next counter, so a leaked token can neither add a device to nor remove one from any account that already has one,
 * a shard's operator included. Bots are never recorded as Realms accounts: they have no name and receive no alerts.
 */
export const handleBotDeviceApproval = (
  request: Request,
  { guardian, accountClassHash }: Pick<DeviceChangeDependencies, "guardian" | "accountClassHash">,
): Promise<Response> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { label, ...requested } = yield* Effect.tryPromise({
        try: () => request.json(),
        catch: () => undefined,
      }).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(BotDeviceRequest)),
        Effect.mapError(() => new DeviceRequestError({ code: "invalid_device_change", status: 400 })),
      );
      if (requested.action !== "ADD" || requested.counter !== 1) {
        return yield* new DeviceRequestError({ code: "bot_first_device_only", status: 403 });
      }
      const guardianPublicKey = yield* Effect.promise(() => guardian.publicKey());
      const botAccount = realmsAccountAddress(botRealmsId(label), accountClassHash, guardianPublicKey);
      if (BigInt(requested.account) !== BigInt(botAccount)) {
        return yield* new DeviceRequestError({ code: "not_a_bot_account", status: 403 });
      }
      const change: DeviceChange = requested;
      const signature = yield* Effect.promise(() => guardian.signDeviceChange(change));
      return json({ ...change, signature: [signature.r, signature.s] });
    }).pipe(
      Effect.catchTag("DeviceRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );

const readDeviceChange = (request: Request) =>
  Effect.tryPromise({ try: () => request.json(), catch: () => undefined }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(DeviceChangeRequest)),
    Effect.map((change): DeviceChange => change),
    Effect.mapError(() => new DeviceRequestError({ code: "invalid_device_change", status: 400 })),
  );

/** Once a key is revoked from a Realms account, no shard's account gets it back, even after a fresh sign-in. */
const isRevokedDevice = (db: D1Database, realmsId: string, deviceKey: string) =>
  Effect.promise(
    async () =>
      (await db
        .prepare('SELECT 1 FROM "revoked_devices" WHERE "realmsId" = ? AND "deviceKey" = ?')
        .bind(realmsId, canonicalFelt(deviceKey))
        .first()) !== null,
  );

/** The session that asked for a key's approval is that device's session: removing the key ends it. */
const recordDeviceSession = (db: D1Database, realmsId: string, deviceKey: string, sessionId: string) =>
  Effect.promise(() =>
    db
      .prepare(
        'INSERT INTO "device_sessions" ("realmsId", "deviceKey", "sessionId") VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      )
      .bind(realmsId, canonicalFelt(deviceKey), sessionId)
      .run(),
  );

/**
 * Revokes the key for the whole Realms account and signs out every session that obtained an approval for it, in one
 * write. A removed browser keeps its cookie, and a live session could mint a new key and ask for its approval.
 */
const removeDevice = (db: D1Database, realmsId: string, deviceKey: string) =>
  Effect.promise(() =>
    db.batch([
      db
        .prepare(
          'INSERT INTO "revoked_devices" ("realmsId", "deviceKey", "revokedAt") VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
        )
        .bind(realmsId, canonicalFelt(deviceKey), Date.now()),
      db
        .prepare(
          'DELETE FROM "session" WHERE "id" IN (SELECT "sessionId" FROM "device_sessions" WHERE "realmsId" = ? AND "deviceKey" = ?)',
        )
        .bind(realmsId, canonicalFelt(deviceKey)),
    ]),
  );

const canonicalFelt = (value: string) => `0x${BigInt(value).toString(16)}`;
