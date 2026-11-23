import { orders, ordersOfAspect, type AspectId } from "@bibliothecadao/types";
import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";
import { json, readBody } from "./http";

const BODY_BYTES = 256;

type OrderIntent = { order: number | null; members: Record<number, number> };

export function handleOrderIntent(request: Request, auth: IdentityAuth, db: D1Database): Promise<Response> {
  return Effect.runPromise(
    serveOrderIntent(request, auth, db).pipe(
      Effect.catchTag("OrderIntentError", (error) => Effect.succeed(json({ error: error.code }, error.status))),
    ),
  );
}

function serveOrderIntent(request: Request, auth: IdentityAuth, db: D1Database) {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new OrderIntentError({ code: "authentication_unavailable", status: 503 }),
    });
    if (!session?.user.realmsId) return json({ error: "unauthorized" }, 401);
    const owner = session.user.realmsId;
    if (request.method === "GET") return json(yield* readIntent(db, owner));
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
      return json({ error: "json_required" }, 415);
    const order = yield* Effect.tryPromise({
      try: async () => catalogOrder(JSON.parse(await readBody(request, BODY_BYTES))),
      catch: () => new OrderIntentError({ code: "invalid_order", status: 400 }),
    });
    if (order === null) return json({ error: "invalid_order" }, 400);
    yield* chooseOrder(db, owner, order);
    const intent = yield* readIntent(db, owner);
    return intent.order === order ? json(intent) : json({ error: "aspect_chosen" }, 409);
  });
}

const catalogOrder = (value: unknown): number | null => {
  const order = (value as { order?: unknown } | null)?.order;
  return orders.some(({ orderId, aspect }) => orderId === order && aspect !== null) ? (order as number) : null;
};

const readIntent = (db: D1Database, owner: string) =>
  Effect.tryPromise({
    try: async (): Promise<OrderIntent> => {
      const { results } = await db
        .prepare('SELECT "order", COUNT(*) AS "members" FROM "order_intents" GROUP BY "order"')
        .all<{ order: number; members: number }>();
      return {
        order: await keptOrder(db, owner),
        members: Object.fromEntries(results.map(({ order, members }) => [order, members])),
      };
    },
    catch: () => new OrderIntentError({ code: "order_intent_unavailable", status: 503 }),
  });

const chooseOrder = (db: D1Database, owner: string, order: number) =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare(
          `INSERT INTO "order_intents" ("owner", "order", "chosen_at") VALUES (?, ?, ?) ON CONFLICT ("owner") DO UPDATE SET "order" = excluded."order", "chosen_at" = excluded."chosen_at" WHERE "order_intents"."order" IN (SELECT value FROM json_each(?))`,
        )
        .bind(owner, order, Date.now(), JSON.stringify(sameAspectOrders(order)))
        .run(),
    catch: () => new OrderIntentError({ code: "order_intent_unavailable", status: 503 }),
  });

const sameAspectOrders = (order: number) => {
  const aspect = orders.find(({ orderId }) => orderId === order)?.aspect;
  if (!aspect) throw new Error(`Order ${order} plays for no Aspect`);
  return ordersOfAspect(aspect).map(({ orderId }) => orderId);
};

const keptOrder = async (db: D1Database, owner: string): Promise<number | null> =>
  (await db.prepare('SELECT "order" FROM "order_intents" WHERE "owner" = ?').bind(owner).first<{ order: number }>())
    ?.order ?? null;

export const intendedAspect = async (db: D1Database, owner: string): Promise<AspectId | null> => {
  const kept = await keptOrder(db, owner);
  return orders.find(({ orderId }) => orderId === kept)?.aspect ?? null;
};

export const inviteSide = async (db: D1Database, sharer: string, aspect: AspectId) => {
  const counted = await db
    .prepare('SELECT COUNT(*) AS "members" FROM "order_intents" WHERE "order" IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(ordersOfAspect(aspect).map(({ orderId }) => orderId)))
    .first<{ members: number }>();
  return { order: await keptOrder(db, sharer), members: counted?.members ?? 0 };
};

class OrderIntentError extends Data.TaggedError("OrderIntentError")<{
  readonly code: string;
  readonly status: 400 | 503;
}> {}
