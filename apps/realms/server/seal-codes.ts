import { Data, Effect } from "effect";
import type { SealCodeRefusal } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { sealCodeHash, readPublicCode } from "./public-codes";
import { json, readBody } from "./http";
import type { IdentityEnv } from "./env";
import { enteredGamesOf, type EnteredGames, type NamedGame } from "./shop-game";

const BODY_BYTES = 256;

export interface SealCodeWorld {
  db: D1Database;
  enteredGames: EnteredGames;
  grantSeal: (game: NamedGame, realmsId: string) => Promise<Response>;
}

export const sealCodeWorldOf = (
  env: Pick<IdentityEnv, "DB" | "GUARDIAN" | "VALUE_RELAY" | "OPERATOR_TOKEN">,
  fetchShard: typeof fetch,
): SealCodeWorld => ({
  db: env.DB,
  enteredGames: enteredGamesOf(env, fetchShard, () => Math.floor(Date.now() / 1000)),
  grantSeal: (game, realmsId) =>
    env.VALUE_RELAY.fetch("https://value-relay/api/value/operator/seal", {
      method: "POST",
      redirect: "manual",
      headers: { authorization: `Bearer ${env.OPERATOR_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ ...game, realmsId }),
    }),
});

export async function deliverQueuedSealGrants(world: SealCodeWorld): Promise<void> {
  const queued = await world.db
    .prepare('SELECT "owner" FROM "seal_grants" ORDER BY "queued_at"')
    .all<{ owner: string }>();
  for (const { owner } of queued.results) await deliverSealGrant(world, owner);
}

export function handleSealCode(request: Request, auth: IdentityAuth, world: SealCodeWorld): Promise<Response> {
  return Effect.runPromise(
    serveSealCode(request, auth, world).pipe(
      Effect.catchTag("SealCodeError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );
}

function serveSealCode(request: Request, auth: IdentityAuth, world: SealCodeWorld) {
  return Effect.gen(function* () {
    const { db } = world;
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new SealCodeError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const owner = session.user.realmsId;
    if (request.method === "GET") return json({ held: yield* holdsCode(db, owner) });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const code = yield* Effect.tryPromise({
      try: async () => readPublicCode((JSON.parse(await readBody(request, BODY_BYTES)) as { code?: unknown }).code),
      catch: () => new SealCodeError({ code: "invalid_code", status: 400 }),
    });
    if (code === null) return refuse("invalid_code", 400);
    yield* holdCode(db, owner, code);
    if (!(yield* holdsCode(db, owner))) return refuse("code_unavailable", 410);
    yield* sealStorage(() =>
      db
        .prepare('INSERT OR IGNORE INTO "seal_grants" ("owner", "queued_at") VALUES (?, ?)')
        .bind(owner, Math.floor(Date.now() / 1000))
        .run(),
    );
    yield* Effect.promise(() => deliverSealGrant(world, owner));
    return json({ held: true });
  });
}

const refuse = (refusal: SealCodeRefusal, status: 400 | 410) => json({ error: refusal }, status);

export const holdsSeal = async (db: D1Database, owner: string) =>
  (await db.prepare('SELECT 1 FROM "seal_codes" WHERE "owner" = ?').bind(owner).first()) !== null;

const deliverSealGrant = async (world: SealCodeWorld, owner: string) => {
  try {
    for (const game of await world.enteredGames(owner))
      if (!(await world.grantSeal(game, owner)).ok)
        throw new Error(`the relay refused the Seal in game ${game.gameId}`);
    await world.db.prepare('DELETE FROM "seal_grants" WHERE "owner" = ?').bind(owner).run();
  } catch (error) {
    console.warn("[seal-code] a held code's Seal waits for the next cron", owner, error);
  }
};

const holdsCode = (db: D1Database, owner: string) => sealStorage(() => holdsSeal(db, owner));

const holdCode = (db: D1Database, owner: string, code: string) =>
  sealStorage(async () => {
    const now = Math.floor(Date.now() / 1000);
    return db
      .prepare(
        `UPDATE "seal_codes" SET "owner" = ?1, "redeemed_at" = ?2
         WHERE "code_hash" = ?3 AND "owner" IS NULL AND ("expires_at" IS NULL OR "expires_at" > ?2)
         AND NOT EXISTS (SELECT 1 FROM "seal_codes" WHERE "owner" = ?1)`,
      )
      .bind(owner, now, await sealCodeHash(code))
      .run();
  });

const sealStorage = <T>(read: () => Promise<T>) =>
  Effect.tryPromise({ try: read, catch: () => new SealCodeError({ code: "seal_codes_unavailable", status: 503 }) });

class SealCodeError extends Data.TaggedError("SealCodeError")<{
  readonly code: string;
  readonly status: 400 | 503;
}> {}
