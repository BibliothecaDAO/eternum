import { Data, Effect, Schema } from "effect";
import { hash, num } from "starknet";
import type { DeviceChange, Guardian } from "@realms-world/guardian";

import type { IdentityAuth } from "./auth";
import { json } from "./http";

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
 * the one the caller's Realms id places on every shard, and the caller must have a way back in (a passkey or a linked
 * wallet), so an abandoned anonymous sign-up never obtains an approval.
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
    if (!(yield* hasWayBackIn(db, session.user))) {
      return yield* new DeviceRequestError({ code: "account_not_secured", status: 403 });
    }
    const guardianPublicKey = yield* Effect.promise(() => guardian.publicKey());
    const ownAccount = realmsAccountAddress(realmsId, accountClassHash, guardianPublicKey);
    if (BigInt(change.account) !== BigInt(ownAccount)) {
      return yield* new DeviceRequestError({ code: "not_your_account", status: 403 });
    }
    const signature = yield* Effect.promise(() => guardian.signDeviceChange(change));
    return { ...change, signature: [signature.r, signature.s] };
  });

const readDeviceChange = (request: Request) =>
  Effect.tryPromise({ try: () => request.json(), catch: () => undefined }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(DeviceChangeRequest)),
    Effect.map((change): DeviceChange => change),
    Effect.mapError(() => new DeviceRequestError({ code: "invalid_device_change", status: 400 })),
  );

const hasWayBackIn = (db: D1Database, user: { id: string; address?: string | null | undefined }) =>
  Effect.promise(async () =>
    user.address
      ? true
      : (await db.prepare('SELECT 1 FROM "passkey" WHERE "userId" = ? LIMIT 1').bind(user.id).first()) !== null,
  );

/** Deployed with salt = Realms id and constructor (realms_id, guardian_public_key) from no deployer. */
export const realmsAccountAddress = (realmsId: string, accountClassHash: string, guardianPublicKey: string): string =>
  num.toHex(hash.calculateContractAddressFromHash(realmsId, accountClassHash, [realmsId, guardianPublicKey], 0));
