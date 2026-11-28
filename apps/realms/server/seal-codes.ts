import { Data, Effect } from "effect";
import type { SealCodeRefusal } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { deriveSealCodes, formatSealCode, readSealCode, SEAL_CODE_LABEL_PATTERN, sealCodeHash } from "./public-codes";
import { json, readBody } from "./http";
import type { IdentityEnv } from "./env";
import { enteredGamesOf, type EnteredGames, type NamedGame } from "./shop-game";

const BODY_BYTES = 256;
const OPERATOR_BODY_BYTES = 1024;
const MAX_SEAL_CODE_MINT_COUNT = 200;
const ROWS_PER_INSERT = 25;

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
      try: async () => readSealCode((JSON.parse(await readBody(request, BODY_BYTES)) as { code?: unknown }).code),
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

interface SealCodeLabelSummaryRow {
  label: string;
  issued: number;
  redeemed: number;
  remaining: number;
  expired: number;
}

export async function handleOperatorSealCodes(
  request: Request,
  db: D1Database,
  secret: string,
  now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<Response> {
  if (request.method === "GET") return summarizeSealCodes(db, now());
  if (request.method === "POST") return mintOperatorSealCodes(request, db, secret, now());
  return json({ error: "method_not_allowed" }, 405);
}

const summarizeSealCodes = async (db: D1Database, now: number): Promise<Response> => {
  try {
    const rows = await db
      .prepare(
        `SELECT
           "label",
           COUNT(*) AS "issued",
           SUM(CASE WHEN "owner" IS NOT NULL THEN 1 ELSE 0 END) AS "redeemed",
           SUM(CASE WHEN "owner" IS NULL AND ("expires_at" IS NULL OR "expires_at" > ?1) THEN 1 ELSE 0 END) AS "remaining",
           SUM(CASE WHEN "owner" IS NULL AND "expires_at" IS NOT NULL AND "expires_at" <= ?1 THEN 1 ELSE 0 END) AS "expired"
         FROM "seal_codes"
         GROUP BY "label"
         ORDER BY "label" ASC`,
      )
      .bind(now)
      .all<SealCodeLabelSummaryRow>();
    return json({
      labels: rows.results.map((row) => ({
        label: row.label,
        issued: Number(row.issued),
        redeemed: Number(row.redeemed),
        remaining: Number(row.remaining),
        expired: Number(row.expired),
      })),
    });
  } catch {
    return json({ error: "seal_codes_unavailable" }, 503);
  }
};

const mintOperatorSealCodes = async (
  request: Request,
  db: D1Database,
  secret: string,
  now: number,
): Promise<Response> => {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    return json({ error: "json_required" }, 415);
  const parsed = await readMintOrder(request, now);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  try {
    const existing = (
      await db
        .prepare('SELECT "code_hash" AS "codeHash", "expires_at" AS "expiresAt" FROM "seal_codes" WHERE "label" = ?1')
        .bind(parsed.label)
        .all<{ codeHash: string; expiresAt: number | null }>()
    ).results;
    if (existing.length > 0 && existing.some((row) => row.expiresAt !== parsed.expiresAt))
      return json({ error: "label_expiry_mismatch" }, 409);
    const derivedCount = Math.max(parsed.count, existing.length);
    const allRawCodes = await deriveSealCodes(parsed.label, derivedCount, secret);
    const allHashes = await Promise.all(allRawCodes.map((code) => sealCodeHash(code)));
    if (existing.length > 0) {
      const derivedHashes = new Set(allHashes);
      if (existing.some((row) => !derivedHashes.has(row.codeHash))) return json({ error: "label_key_mismatch" }, 409);
    }
    const rawCodes = allRawCodes.slice(0, parsed.count);
    const hashes = allHashes.slice(0, parsed.count);
    await db.batch(buildInsertStatements(db, hashes, parsed.label, parsed.expiresAt));
    return json({ label: parsed.label, expiresAt: parsed.expiresAt, codes: rawCodes.map(formatSealCode) }, 201);
  } catch {
    return json({ error: "seal_codes_unavailable" }, 503);
  }
};

const readMintOrder = async (
  request: Request,
  now: number,
): Promise<{ label: string; count: number; expiresAt: number | null } | { error: string }> => {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(await readBody(request, OPERATOR_BODY_BYTES));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "invalid_body" };
    body = parsed as Record<string, unknown>;
  } catch {
    return { error: "invalid_body" };
  }
  if (typeof body.label !== "string" || !SEAL_CODE_LABEL_PATTERN.test(body.label)) return { error: "invalid_label" };
  if (
    typeof body.count !== "number" ||
    !Number.isInteger(body.count) ||
    body.count < 1 ||
    body.count > MAX_SEAL_CODE_MINT_COUNT
  )
    return { error: "invalid_count" };
  if (body.expiresAt !== undefined && body.expiresAt !== null) {
    if (typeof body.expiresAt !== "number" || !Number.isSafeInteger(body.expiresAt) || body.expiresAt <= now)
      return { error: "invalid_expiry" };
    return { label: body.label, count: body.count, expiresAt: body.expiresAt };
  }
  return { label: body.label, count: body.count, expiresAt: null };
};

const buildInsertStatements = (
  db: D1Database,
  hashes: string[],
  label: string,
  expiresAt: number | null,
): D1PreparedStatement[] => {
  const statements: D1PreparedStatement[] = [];
  for (let start = 0; start < hashes.length; start += ROWS_PER_INSERT) {
    const chunk = hashes.slice(start, start + ROWS_PER_INSERT);
    const placeholders = chunk.map(() => "(?, ?, ?)").join(", ");
    const params: (string | number | null)[] = [];
    for (const codeHash of chunk) params.push(codeHash, label, expiresAt);
    statements.push(
      db
        .prepare(
          `INSERT INTO "seal_codes" ("code_hash", "label", "expires_at") VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        )
        .bind(...params),
    );
  }
  return statements;
};
