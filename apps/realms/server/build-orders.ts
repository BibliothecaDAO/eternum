import { buildOrderBookValue, readBuildOrderBook } from "@bibliothecadao/eternum/build-order";
import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { BuildOrderStore, type StoredBuildOrderBook } from "./build-order-store";
import { json, readBody } from "./http";

/** 20 orders of 60 steps each fit well within it. */
const BOOK_BYTES = 64 * 1024;

/**
 * GET and POST /api/build-orders: the signed-in account's Blitz build orders, saved by revision. A save is read by the
 * game's own build order reader, and refused with its reason when an order does not read.
 */
export function handleBuildOrders(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    serveBuildOrders(request, auth).pipe(
      Effect.provide(BuildOrderStore.layer(db)),
      Effect.catchTag("BuildOrderStorageError", () => Effect.succeed(json({ error: "build_orders_unavailable" }, 503))),
      Effect.catchTag("BuildOrderRequestError", (error) =>
        Effect.succeed(json({ error: error.code, message: error.message }, error.status)),
      ),
    ),
  );
}

function serveBuildOrders(request: Request, auth: IdentityAuth) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new BuildOrderRequestError({ code: "authentication_unavailable", status: 503, message: "" }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const owner = session.user.realmsId;
    const store = yield* BuildOrderStore;
    if (request.method === "GET") return json(answer(yield* store.read(owner)));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const change = yield* Effect.tryPromise({
      try: async () => readChange(JSON.parse(await readBody(request, BOOK_BYTES))),
      catch: () => new BuildOrderRequestError({ code: "invalid_build_orders", status: 400, message: "" }),
    });
    if ("error" in change) return json({ error: "invalid_build_orders", message: change.error }, 400);
    // Ownership is authenticated; this field keeps an account switch from retargeting an in-flight save.
    if (change.owner !== owner) return json({ error: "owner_changed" }, 403);
    const saved = yield* store.save(owner, change.book, change.revision);
    return saved ? json(answer(saved)) : json({ error: "build_order_conflict" }, 409);
  });
}

/** A save: its owner and revision, and its book as the game reads it, stored in its shared form. */
const readChange = (value: unknown): { owner: string; revision: number; book: string } | { error: string } => {
  const { owner, revision, book } = (value ?? {}) as Record<string, unknown>;
  if (typeof owner !== "string" || typeof revision !== "number" || !Number.isInteger(revision) || revision < 0)
    return { error: "A save names its account and revision." };
  const read = readBuildOrderBook(book);
  if ("error" in read) return read;
  return { owner, revision, book: JSON.stringify(buildOrderBookValue(read.ok)) };
};

const answer = ({ owner, book, revision }: StoredBuildOrderBook) => ({ owner, revision, book: JSON.parse(book) });

class BuildOrderRequestError extends Data.TaggedError("BuildOrderRequestError")<{
  readonly code: string;
  readonly status: 400 | 503;
  readonly message: string;
}> {}
