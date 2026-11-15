import { SEAL_CENTS, STORE_PRODUCTS } from "@bibliothecadao/types";

import type { IdentityAuth } from "./auth";
import type { IdentityEnv } from "./env";
import { json, readBody } from "./http";
import { RealmHoldingsUnavailableError } from "./realm-holdings";
import { holderLevelOf, readSeal, type HolderFacts } from "./seal";

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

/** What came of a verified payment, as the ledger records it. */
type Outcome = "seal" | "seal_held" | "fragments" | "unfulfilled_price" | "unfulfilled_product";

type Product = (typeof STORE_PRODUCTS)[keyof typeof STORE_PRODUCTS];

/**
 * POST /api/shop/receipt: a store purchase of the signed-in account, checked with its store. Every verified payment is
 * written once to the receipt ledger with its outcome, in one transaction with what it buys: the seal, when the
 * product's price covers the seal's store price for this account's holder level, or a pending Fragment credit for the
 * co-signed hand-off. A payment that cannot be honoured is recorded as unfulfilled for the owner to refund. The same
 * receipt sent again answers as it did the first time; one another account used is refused.
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
  try {
    return await settleReceipt(world, owner, `${asked.store}:${purchase.transactionId}`, purchase.productId);
  } catch (error) {
    if (error instanceof RealmHoldingsUnavailableError) return json({ error: "holdings_unavailable" }, 503);
    throw error;
  }
}

const SETTLE_ATTEMPTS = 3;

/**
 * Settles a verified payment through the ledger: an earlier row for the receipt answers it; otherwise the ledger row and
 * what it buys are written in one batch. A batch that loses a race (the same receipt, or a seal this account just
 * bought with another receipt) writes nothing, and the next pass reads the winner.
 */
const settleReceipt = async (world: ReceiptWorld, owner: string, receipt: string, productId: string) => {
  const product = productOf(productId);
  const now = world.now();
  let lastError: unknown;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    const recorded = await world.db
      .prepare('SELECT "owner", "product", "outcome" FROM "store_receipts" WHERE "receipt" = ?')
      .bind(receipt)
      .first<{ owner: string | null; product: string; outcome: Outcome }>();
    if (recorded)
      return recorded.owner === owner
        ? answerFor(recorded.outcome, productOf(recorded.product), true)
        : json({ error: "receipt_used" }, 409);
    const outcome = await outcomeOf(world, owner, product);
    try {
      await world.db.batch([
        ledgerRow(world.db, { receipt, owner, productId, outcome, now }),
        ...fulfilment(world.db, { receipt, owner, product, outcome, now }),
      ]);
      return answerFor(outcome, product, false);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

/** What this payment can buy this account now; the seal's price is judged by the account's live holder level. */
const outcomeOf = async (world: ReceiptWorld, owner: string, product: Product | undefined): Promise<Outcome> => {
  if (!product) return "unfulfilled_product";
  if (product.kind === "fragments") return "fragments";
  const holder = product.cents < SEAL_CENTS.store.none ? holderLevelOf(await world.holderFacts(owner)) : "none";
  if (product.cents < SEAL_CENTS.store[holder]) return "unfulfilled_price";
  return (await readSeal(world.db, owner)) ? "seal_held" : "seal";
};

const productOf = (productId: string): Product | undefined =>
  Object.hasOwn(STORE_PRODUCTS, productId) ? STORE_PRODUCTS[productId as keyof typeof STORE_PRODUCTS] : undefined;

const ledgerRow = (
  db: D1Database,
  row: { receipt: string; owner: string; productId: string; outcome: Outcome; now: number },
) =>
  db
    .prepare(
      'INSERT INTO "store_receipts" ("receipt", "product", "received_at", "owner", "outcome") VALUES (?, ?, ?, ?, ?)',
    )
    .bind(row.receipt, row.productId, row.now, row.owner, row.outcome);

/** The rows an outcome buys, written in the same batch as its ledger row. */
const fulfilment = (
  db: D1Database,
  buy: { receipt: string; owner: string; product: Product | undefined; outcome: Outcome; now: number },
) => {
  const { receipt, owner, product, outcome, now } = buy;
  if (outcome === "seal" && product?.kind === "seal")
    return [
      db
        .prepare('INSERT INTO "seal" ("owner", "paid_cents", "source", "receipt", "granted_at") VALUES (?, ?, ?, ?, ?)')
        .bind(owner, product.cents, "store", receipt, now),
    ];
  if (outcome === "fragments" && product?.kind === "fragments")
    return [
      db
        .prepare('INSERT INTO "fragment_credits" ("receipt", "owner", "fragments", "created_at") VALUES (?, ?, ?, ?)')
        .bind(receipt, owner, product.fragments, now),
    ];
  return [];
};

const answerFor = (outcome: Outcome, product: Product | undefined, repeated: boolean) => {
  switch (outcome) {
    case "seal":
      return json({ status: "seal", repeated });
    case "seal_held":
      return json({ status: "seal", repeated: true });
    case "fragments":
      if (product?.kind !== "fragments") throw new Error("ledger_fragments_for_unknown_product");
      return json({ status: "fragments", fragments: product.fragments, repeated });
    case "unfulfilled_price":
      return json({ error: "seal_price_not_for_holder" }, 409);
    case "unfulfilled_product":
      return json({ error: "unknown_product" }, 422);
  }
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
