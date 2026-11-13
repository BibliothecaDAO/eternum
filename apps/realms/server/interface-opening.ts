import { parseOpeningChange } from "@realms-world/identity";
import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { json, readBody } from "./http";
import { InterfaceOpeningStore } from "./interface-opening-store";

/**
 * GET and POST /api/interface/opening: the moments of Frontier's opening interface the signed-in account reached, and
 * its Show everything. A save adds moments and never removes one.
 */
export function handleInterfaceOpening(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    serveInterfaceOpening(request, auth).pipe(
      Effect.provide(InterfaceOpeningStore.layer(db)),
      Effect.catchTag("InterfaceOpeningStorageError", () =>
        Effect.succeed(json({ error: "interface_opening_unavailable" }, 503)),
      ),
      Effect.catchTag("InterfaceOpeningRequestError", (error) =>
        Effect.succeed(json({ error: error.code }, error.status)),
      ),
    ),
  );
}

function serveInterfaceOpening(request: Request, auth: IdentityAuth) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new InterfaceOpeningRequestError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const owner = session.user.realmsId;
    const store = yield* InterfaceOpeningStore;
    if (request.method === "GET") return json(yield* store.read(owner));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const change = yield* Effect.tryPromise({
      try: async () => parseOpeningChange(JSON.parse(await readBody(request, 1024))),
      catch: () => new InterfaceOpeningRequestError({ code: "invalid_interface_opening", status: 400 }),
    });
    // Ownership is authenticated; this field keeps an account switch from retargeting an in-flight save.
    if (change.owner !== owner) return json({ error: "owner_changed" }, 403);
    return json(yield* store.save(change));
  });
}

class InterfaceOpeningRequestError extends Data.TaggedError("InterfaceOpeningRequestError")<{
  readonly code: string;
  readonly status: 400 | 503;
}> {}
