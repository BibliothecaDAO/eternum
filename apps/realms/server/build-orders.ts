import { buildOrderBookValue, readBuildOrderBook } from "@bibliothecadao/eternum/build-order";
import { Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { BuildOrderStore, type StoredBuildOrderBook } from "./build-order-store";
import { isJsonRequest, json, readJsonBody, Refusal, respond, signedIn } from "./http";

/** 20 orders of 60 steps each fit well within it. */
const BOOK_BYTES = 64 * 1024;

/**
 * GET and POST /api/build-orders: the signed-in account's Blitz build orders, saved by revision. A save is read by the
 * game's own build order reader, and refused with its reason when an order does not read.
 */
export function handleBuildOrders(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return respond(
    serveBuildOrders(request, auth).pipe(
      Effect.provide(BuildOrderStore.layer(db)),
      Effect.catchTag("BuildOrderStorageError", () =>
        Effect.fail(new Refusal({ code: "build_orders_unavailable", status: 503 })),
      ),
    ),
  );
}

function serveBuildOrders(request: Request, auth: IdentityAuth) {
  return Effect.gen(function* () {
    const { realmsId: owner } = yield* signedIn(auth, request);
    const store = yield* BuildOrderStore;
    if (request.method === "GET") return json(answer(yield* store.read(owner)));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (!isJsonRequest(request)) return json({ error: "json_required" }, 415);
    const change = readChange(yield* readJsonBody(request, BOOK_BYTES, "invalid_build_orders"));
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
