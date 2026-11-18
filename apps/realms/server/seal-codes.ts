import { Data, Effect } from "effect";
import type { SealCodeRefusal } from "@realms-world/identity";

import type { IdentityAuth } from "./auth";
import { codeHashInScope, readCampaignCode } from "./campaigns";
import { json, readBody } from "./http";
import { readSeal } from "./seal";

const BODY_BYTES = 256;

export function handleSealCode(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    serveSealCode(request, auth, db).pipe(
      Effect.catchTag("SealCodeError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );
}

function serveSealCode(request: Request, auth: IdentityAuth, db: D1Database) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new SealCodeError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const owner = session.user.realmsId;
    if (request.method === "GET")
      return json({ held: (yield* ownsSeal(db, owner)) || (yield* sealStorage(() => holdsFreeSeal(db, owner))) });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const code = yield* Effect.tryPromise({
      try: async () => readCampaignCode((JSON.parse(await readBody(request, BODY_BYTES)) as { code?: unknown }).code),
      catch: () => new SealCodeError({ code: "invalid_code", status: 400 }),
    });
    if (code === null) return refuse("invalid_code", 400);
    if ((yield* ownsSeal(db, owner)) || (yield* holdsTicket(db, owner))) return refuse("seal_owned", 409);
    yield* holdCode(db, owner, code);
    return (yield* holdsCode(db, owner)) ? json({ held: true }) : refuse("code_unavailable", 410);
  });
}

const refuse = (refusal: SealCodeRefusal, status: 400 | 409 | 410) => json({ error: refusal }, status);

const ownsSeal = (db: D1Database, owner: string) => sealStorage(async () => (await readSeal(db, owner)) !== null);

export const holdsFreeSeal = async (db: D1Database, owner: string) =>
  (await db
    .prepare('SELECT 1 FROM "seal_codes" WHERE "owner" = ?1 UNION ALL SELECT 1 FROM "campaign_tickets" WHERE "owner" = ?1')
    .bind(owner)
    .first()) !== null;

const holdsTicket = (db: D1Database, owner: string) =>
  sealStorage(async () => {
    const held = await db.prepare('SELECT 1 FROM "campaign_tickets" WHERE "owner" = ?').bind(owner).first();
    return held !== null;
  });

const holdsCode = (db: D1Database, owner: string) =>
  sealStorage(async () => {
    const held = await db.prepare('SELECT 1 FROM "seal_codes" WHERE "owner" = ?').bind(owner).first();
    return held !== null;
  });

const holdCode = (db: D1Database, owner: string, code: string) =>
  sealStorage(async () => {
    const now = Math.floor(Date.now() / 1000);
    return db
      .prepare(
        `UPDATE "seal_codes" SET "owner" = ?1, "redeemed_at" = ?2
         WHERE "code_hash" = ?3 AND "owner" IS NULL AND ("expires_at" IS NULL OR "expires_at" > ?2)
         AND NOT EXISTS (SELECT 1 FROM "seal_codes" WHERE "owner" = ?1)`,
      )
      .bind(owner, now, await codeHashInScope("seal", code))
      .run();
  });

const sealStorage = <T>(read: () => Promise<T>) =>
  Effect.tryPromise({ try: read, catch: () => new SealCodeError({ code: "seal_codes_unavailable", status: 503 }) });

class SealCodeError extends Data.TaggedError("SealCodeError")<{
  readonly code: string;
  readonly status: 400 | 503;
}> {}
