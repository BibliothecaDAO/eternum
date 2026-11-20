import { STORE_PRODUCTS } from "@bibliothecadao/types";

import type { IdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { json, readBody } from "./http";
import { authorizeShop, namedGame, type NamedGame, type ShopAccess } from "./shop-game";

const BODY_BYTES = 32 * 1024;
const STORES = ["apple", "google"] as const;

/** The store's own account of a payment: its id for it, and the product it was for. */
export interface VerifiedPurchase {
  transactionId: string;
  productId: string;
}

/** Asks one store whether a receipt is a real, paid purchase; null when it is not. Throws when the store cannot say. */
export type StoreVerifier = (evidence: string) => Promise<VerifiedPurchase | null>;

export interface ReceiptWorld {
  db: D1Database;
  access: ShopAccess;
  /** Only the stores that are set up: a store without a verifier is refused, never believed. */
  verifiers: Partial<Record<(typeof STORES)[number], StoreVerifier>>;
  now: () => number;
}

/** What came of a verified payment, as the ledger records it. */
type Outcome =
  | "fragments"
  | "unfulfilled_product"
  | "unfulfilled_deleted"
  | "unfulfilled_not_in_game"
  | "pending_eligibility";

type Product = (typeof STORE_PRODUCTS)[keyof typeof STORE_PRODUCTS];

export async function handlePurchaseCheck(
  request: Request,
  auth: IdentityAuth,
  world: Pick<ReceiptWorld, "access">,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const asked = await readPurchase(request);
  const seat = await authorizeShop(request, auth, world.access, asked?.game ?? null);
  if (seat instanceof Response) return seat;
  const product = asked?.product === undefined ? undefined : productOf(asked.product);
  return product ? json({ status: "ok" }) : json({ error: "unknown_product" }, 422);
}

const readPurchase = async (request: Request): Promise<{ game: NamedGame | null; product: string } | null> => {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  try {
    const body = JSON.parse(await readBody(request, BODY_BYTES)) as Record<string, unknown>;
    return typeof body.product === "string" ? { game: namedGame(body.chain, body.game), product: body.product } : null;
  } catch {
    return null;
  }
};

export async function handleStoreReceipt(request: Request, auth: IdentityAuth, world: ReceiptWorld): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const session = await auth.api.getSession({ headers: request.headers });
  const owner = session?.user.realmsId;
  if (!owner) return json({ error: "unauthorized" }, 401);
  const asked = await readRequest(request);
  if (!asked) return json({ error: "invalid_receipt" }, 400);
  const verify = world.verifiers[asked.store];
  if (!verify) return json({ error: "store_unavailable" }, 503);
  let purchase: VerifiedPurchase | null;
  try {
    purchase = await verify(asked.evidence);
  } catch {
    return json({ error: "store_unavailable" }, 503);
  }
  if (!purchase) return json({ error: "receipt_refused" }, 402);
  return settleReceipt(world, owner, `${asked.store}:${purchase.transactionId}`, purchase.productId, asked.game);
}

const SETTLE_ATTEMPTS = 3;

const settleReceipt = async (
  world: ReceiptWorld,
  owner: string,
  receipt: string,
  productId: string,
  game: NamedGame,
) => {
  const product = productOf(productId);
  let lastError: unknown;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    const recorded = await readLedger(world.db, receipt);
    if (recorded && recorded.owner !== owner) return json({ error: "receipt_used" }, 409);
    if (recorded && recorded.outcome !== "pending_eligibility")
      return answerFor(recorded.outcome, productOf(recorded.product), true);
    const outcome = await outcomeOf(world, owner, product, game);
    if (recorded && outcome === "pending_eligibility") return answerFor(outcome, product, true);
    const now = world.now();
    try {
      await world.db.batch([
        recorded
          ? resolvePending(world.db, { receipt, owner, outcome })
          : ledgerRow(world.db, { receipt, owner, productId, outcome, now }),
        ...fulfilment(world.db, { receipt, owner, product, outcome, now, game }),
      ]);
    } catch (error) {
      lastError = error;
      continue;
    }
    const settled = await readLedger(world.db, receipt);
    if (!settled) throw new Error("ledger_row_missing_after_settlement");
    return answerFor(settled.outcome, product, false);
  }
  throw lastError;
};

const readLedger = (db: D1Database, receipt: string) =>
  db
    .prepare('SELECT "owner", "product", "outcome" FROM "store_receipts" WHERE "receipt" = ?')
    .bind(receipt)
    .first<{ owner: string | null; product: string; outcome: Outcome }>();

const outcomeOf = async (
  world: ReceiptWorld,
  owner: string,
  product: Product | undefined,
  game: NamedGame,
): Promise<Outcome> => {
  if (!product) return "unfulfilled_product";
  const plays = await playsInGame(world, owner, game);
  if (plays === null) return "pending_eligibility";
  return plays ? "fragments" : "unfulfilled_not_in_game";
};

/** Whether the account plays in the named running Frontier game; null while its shard cannot say. */
const playsInGame = async (world: ReceiptWorld, owner: string, game: NamedGame): Promise<boolean | null> => {
  try {
    return await world.access(owner, game);
  } catch (error) {
    console.error("[shop] the game's shard could not say who plays", error);
    return null;
  }
};

const productOf = (productId: string): Product | undefined =>
  Object.hasOwn(STORE_PRODUCTS, productId) ? STORE_PRODUCTS[productId as keyof typeof STORE_PRODUCTS] : undefined;

/** The first record of a payment; an owner already deleted is not written, the payment stays recorded for a refund. */
const ledgerRow = (
  db: D1Database,
  row: { receipt: string; owner: string; productId: string; outcome: Outcome; now: number },
) =>
  db
    .prepare(
      `INSERT INTO "store_receipts" ("receipt", "product", "received_at", "owner", "outcome")
       SELECT ?1, ?2, ?3, CASE WHEN "deleted" THEN NULL ELSE ?4 END, CASE WHEN "deleted" THEN 'unfulfilled_deleted' ELSE ?5 END
       FROM (SELECT EXISTS (SELECT 1 FROM "account_deletions" WHERE "realms_id" = ?4) AS "deleted")`,
    )
    .bind(row.receipt, row.productId, row.now, row.owner, row.outcome);

/** A pending payment's outcome, once eligibility is known; only the owner who sent it, only while it is still pending. */
const resolvePending = (db: D1Database, row: { receipt: string; owner: string; outcome: Outcome }) =>
  db
    .prepare(
      'UPDATE "store_receipts" SET "outcome" = ? WHERE "receipt" = ? AND "owner" = ? AND "outcome" = \'pending_eligibility\'',
    )
    .bind(row.outcome, row.receipt, row.owner);

/** Written in the same batch as the ledger row, and only where that row stands as this outcome for this owner. */
const fulfilment = (
  db: D1Database,
  buy: { receipt: string; owner: string; product: Product | undefined; outcome: Outcome; now: number; game: NamedGame },
) => {
  const { receipt, owner, product, outcome, now, game } = buy;
  const stands =
    'WHERE EXISTS (SELECT 1 FROM "store_receipts" WHERE "receipt" = ?1 AND "owner" = ?2 AND "outcome" = ?3)';
  if (outcome === "fragments" && product)
    return [
      db
        .prepare(
          `INSERT INTO "fragment_credits" ("receipt", "owner", "fragments", "created_at", "chain_id", "game_id")
           SELECT ?1, ?2, ?4, ?5, ?6, ?7 ${stands}`,
        )
        .bind(receipt, owner, outcome, product.fragments, now, game.chainId, game.gameId),
    ];
  return [];
};

const answerFor = (outcome: Outcome, product: Product | undefined, repeated: boolean) => {
  switch (outcome) {
    case "fragments":
      if (!product) throw new Error("ledger_fragments_for_unknown_product");
      return json({ status: "fragments", fragments: product.fragments, repeated });
    case "unfulfilled_product":
      return json({ error: "unknown_product" }, 422);
    case "unfulfilled_deleted":
      return json({ error: "account_deleted" }, 410);
    case "unfulfilled_not_in_game":
      return json({ error: "no_shop_outside_a_frontier_game" }, 404);
    case "pending_eligibility":
      return json({ error: "shop_unavailable" }, 503);
  }
};

const readRequest = async (
  request: Request,
): Promise<{ store: (typeof STORES)[number]; evidence: string; game: NamedGame } | null> => {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  try {
    const body = JSON.parse(await readBody(request, BODY_BYTES)) as Record<string, unknown>;
    const store = STORES.find((name) => name === body.store);
    const game = namedGame(body.chain, body.game);
    return store && game && typeof body.receipt === "string" && body.receipt.length > 0
      ? { store, evidence: body.receipt, game }
      : null;
  } catch {
    return null;
  }
};

/**
 * The stores this Worker can ask: a store is verified only where its credentials are in the environment, and none are
 * yet, so every receipt is refused as `store_unavailable` rather than believed.
 */
export const storeVerifiersOf = (_env: IdentityEnv): ReceiptWorld["verifiers"] => ({});
