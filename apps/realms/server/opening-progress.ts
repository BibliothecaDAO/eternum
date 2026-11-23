import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { json, readBody } from "./http";

const BODY_BYTES = 4 * 1024;
const MAX_MOMENTS = 64;
const MOMENT_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const KINDS = ["reached", "seen"] as const;

type OpeningProgress = Record<(typeof KINDS)[number], string[]>;

/**
 * GET and POST /api/opening: the signed-in account's opening progress, the moments its interface has opened to and the
 * lines it has been told. A POST adds moments to the account's sets (never removes), so repeating it or sending it
 * from two devices at once ends in the same state.
 */
export function handleOpeningProgress(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    serveOpeningProgress(request, auth, db).pipe(
      Effect.catchTag("OpeningRequestError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );
}

function serveOpeningProgress(request: Request, auth: IdentityAuth, db: D1Database) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new OpeningRequestError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const owner = session.user.realmsId;
    if (request.method === "GET") return json(yield* readProgress(db, owner));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const additions = yield* Effect.tryPromise({
      try: async () => readAdditions(JSON.parse(await readBody(request, BODY_BYTES))),
      catch: () => new OpeningRequestError({ code: "invalid_opening_progress", status: 400 }),
    });
    if (!additions) return json({ error: "invalid_opening_progress" }, 400);
    yield* addMoments(db, owner, additions);
    return json(yield* readProgress(db, owner));
  });
}

/** Each kind's moments as a list of names the game's table uses; null when any is not a plain name. */
const readAdditions = (value: unknown): OpeningProgress | null => {
  const body = (value ?? {}) as Record<string, unknown>;
  const additions: OpeningProgress = { reached: [], seen: [] };
  for (const kind of KINDS) {
    const moments = body[kind] ?? [];
    if (!Array.isArray(moments) || moments.length > MAX_MOMENTS) return null;
    if (!moments.every((moment) => typeof moment === "string" && MOMENT_NAME.test(moment))) return null;
    additions[kind] = moments;
  }
  return additions;
};

const readProgress = (db: D1Database, owner: string) =>
  Effect.tryPromise({
    try: async (): Promise<OpeningProgress> => {
      const { results } = await db
        .prepare('SELECT "moment", "kind" FROM "opening_progress" WHERE "owner" = ? ORDER BY "moment"')
        .bind(owner)
        .all<{ moment: string; kind: (typeof KINDS)[number] }>();
      const progress: OpeningProgress = { reached: [], seen: [] };
      for (const { moment, kind } of results) progress[kind].push(moment);
      return progress;
    },
    catch: () => new OpeningRequestError({ code: "opening_progress_unavailable", status: 503 }),
  });

const addMoments = (db: D1Database, owner: string, additions: OpeningProgress) =>
  Effect.tryPromise({
    try: async () => {
      const insert = db.prepare(
        'INSERT INTO "opening_progress" ("owner", "moment", "kind") VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      );
      const rows = KINDS.flatMap((kind) => additions[kind].map((moment) => insert.bind(owner, moment, kind)));
      if (rows.length > 0) await db.batch(rows);
    },
    catch: () => new OpeningRequestError({ code: "opening_progress_unavailable", status: 503 }),
  });

class OpeningRequestError extends Data.TaggedError("OpeningRequestError")<{
  readonly code: string;
  readonly status: 400 | 503;
}> {}
