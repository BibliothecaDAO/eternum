import { SEAL_CENTS, STORE_PRODUCTS } from "@bibliothecadao/types";

import type { IdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { json, readBody } from "./http";
import { grantSeal, holderLevelOf, type HolderFacts } from "./seal";

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
  holderFacts: (realmsId: string) => Promise<HolderFacts>;
  /** Only the stores that are set up: a store without a verifier is refused, never believed. */
  verifiers: Partial<Record<(typeof STORES)[number], StoreVerifier>>;
  now: () => number;
}

/**
 * POST /api/shop/receipt: a store purchase of the signed-in account, checked with its store. A Fragment bundle writes a
 * pending credit for the co-signed hand-off to deliver; the seal is granted at once, when the product's price covers the
 * seal's store price for this account's holder level. The same receipt sent again answers as it did the first time, and
 * never credits twice; one that another account used is refused.
 */
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
  const product = Object.hasOwn(STORE_PRODUCTS, purchase.productId)
    ? STORE_PRODUCTS[purchase.productId as keyof typeof STORE_PRODUCTS]
    : undefined;
  if (!product) return json({ error: "unknown_product" }, 422);
  const receipt = `${asked.store}:${purchase.transactionId}`;
  const now = world.now();
  if (product.kind === "seal") {
    const holder = holderLevelOf(await world.holderFacts(owner));
    if (product.cents < SEAL_CENTS.store[holder]) return json({ error: "seal_price_not_for_holder" }, 409);
    await world.db
      .prepare(
        'INSERT INTO "store_receipts" ("receipt", "product", "received_at") VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      )
      .bind(receipt, purchase.productId, now)
      .run();
    const outcome = await grantSeal(world.db, {
      owner,
      paidCents: product.cents,
      source: "store",
      receipt,
      now,
    });
    if (outcome === "receipt_used") return json({ error: "receipt_used" }, 409);
    return json({ status: "seal", repeated: outcome === "held" });
  }
  const credit = await creditFragments(world.db, {
    owner,
    receipt,
    productId: purchase.productId,
    fragments: product.fragments,
    now,
  });
  return credit === "used"
    ? json({ error: "receipt_used" }, 409)
    : json({ status: "fragments", fragments: product.fragments, repeated: credit === "repeated" });
}

/** Writes the receipt and its pending credit once; the same account sending it again is `repeated`, another account `used`. */
const creditFragments = async (
  db: D1Database,
  credit: { owner: string; receipt: string; productId: string; fragments: number; now: number },
): Promise<"credited" | "repeated" | "used"> => {
  await db
    .prepare(
      'INSERT INTO "store_receipts" ("receipt", "product", "received_at") VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    )
    .bind(credit.receipt, credit.productId, credit.now)
    .run();
  const written = await db
    .prepare(
      'INSERT INTO "fragment_credits" ("receipt", "owner", "fragments", "created_at") VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING "receipt"',
    )
    .bind(credit.receipt, credit.owner, credit.fragments, credit.now)
    .first();
  if (written) return "credited";
  const held = await db
    .prepare('SELECT "owner" FROM "fragment_credits" WHERE "receipt" = ?')
    .bind(credit.receipt)
    .first<{ owner: string }>();
  return held?.owner === credit.owner ? "repeated" : "used";
};

const readRequest = async (request: Request): Promise<{ store: (typeof STORES)[number]; evidence: string } | null> => {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  try {
    const body = JSON.parse(await readBody(request, BODY_BYTES)) as Record<string, unknown>;
    const store = STORES.find((name) => name === body.store);
    return store && typeof body.receipt === "string" && body.receipt.length > 0
      ? { store, evidence: body.receipt }
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
