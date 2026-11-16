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
type Outcome =
  | "seal"
  | "unfulfilled_seal_held"
  | "fragments"
  | "unfulfilled_price"
  | "unfulfilled_product"
  | "unfulfilled_deleted"
  | "pending_eligibility";

type Product = (typeof STORE_PRODUCTS)[keyof typeof STORE_PRODUCTS];

/**
 * POST /api/shop/receipt: a store purchase of the signed-in account, checked with its store. Every verified payment is
 * written once to the receipt ledger with its outcome, in one transaction with what it buys: the seal, when the
 * product's price covers the seal's store price for this account's holder level, or a pending Fragment credit for the
 * co-signed hand-off. A payment that cannot be honoured (an unknown product, a price below the buyer's, a seal the account already holds, an account already deleted) is recorded as unfulfilled for the owner to refund; one whose
 * holder level cannot be read is recorded as pending, grants nothing, and is resolved when the same receipt is sent
 * again. The same receipt sent again answers as it did the first time; one another account used is refused.
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
  return settleReceipt(world, owner, `${asked.store}:${purchase.transactionId}`, purchase.productId);
}

const SETTLE_ATTEMPTS = 3;

/**
 * Settles a verified payment through the ledger. The receipt is recorded first, whatever else can fail: an earlier row
 * answers it; a payment whose eligibility cannot be read is recorded as pending and resolved by its retry; every other
 * outcome is written with what it buys in one batch. What a batch buys is written only where the ledger row of that
 * batch stands for this owner, so an account deleted before the batch runs (its row owner cleared) buys nothing. A batch
 * that loses a race (the same receipt, or a seal this account just bought with another receipt) writes nothing, and the
 * next pass reads the winner.
 */
const settleReceipt = async (world: ReceiptWorld, owner: string, receipt: string, productId: string) => {
  const product = productOf(productId);
  let lastError: unknown;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    const recorded = await readLedger(world.db, receipt);
    if (recorded && recorded.owner !== owner) return json({ error: "receipt_used" }, 409);
    if (recorded && recorded.outcome !== "pending_eligibility")
      return answerFor(recorded.outcome, productOf(recorded.product), true);
    const outcome = await outcomeOf(world, owner, product);
    if (recorded && outcome === "pending_eligibility") return answerFor(outcome, product, true);
    const now = world.now();
    try {
      await world.db.batch([
        recorded
          ? resolvePending(world.db, { receipt, owner, outcome })
          : ledgerRow(world.db, { receipt, owner, productId, outcome, now }),
        ...fulfilment(world.db, { receipt, owner, product, outcome, now }),
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

/** What this payment can buy this account now; the seal's price is judged by the account's live holder level. */
const outcomeOf = async (world: ReceiptWorld, owner: string, product: Product | undefined): Promise<Outcome> => {
  if (!product) return "unfulfilled_product";
  if (product.kind === "fragments") return "fragments";
  try {
    const holder = product.cents < SEAL_CENTS.store.none ? holderLevelOf(await world.holderFacts(owner)) : "none";
    if (product.cents < SEAL_CENTS.store[holder]) return "unfulfilled_price";
    return (await readSeal(world.db, owner)) ? "unfulfilled_seal_held" : "seal";
  } catch (error) {
    if (error instanceof RealmHoldingsUnavailableError) return "pending_eligibility";
    throw error;
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
  buy: { receipt: string; owner: string; product: Product | undefined; outcome: Outcome; now: number },
) => {
  const { receipt, owner, product, outcome, now } = buy;
  const stands =
    'WHERE EXISTS (SELECT 1 FROM "store_receipts" WHERE "receipt" = ?1 AND "owner" = ?2 AND "outcome" = ?3)';
  if (outcome === "seal" && product?.kind === "seal")
    return [
      db
        .prepare(
          `INSERT INTO "seal" ("owner", "paid_cents", "source", "receipt", "granted_at") SELECT ?2, ?4, 'store', ?1, ?5 ${stands}`,
        )
        .bind(receipt, owner, outcome, product.cents, now),
    ];
  if (outcome === "fragments" && product?.kind === "fragments")
    return [
      db
        .prepare(
          `INSERT INTO "fragment_credits" ("receipt", "owner", "fragments", "created_at") SELECT ?1, ?2, ?4, ?5 ${stands}`,
        )
        .bind(receipt, owner, outcome, product.fragments, now),
    ];
  return [];
};

const answerFor = (outcome: Outcome, product: Product | undefined, repeated: boolean) => {
  switch (outcome) {
    case "seal":
      return json({ status: "seal", repeated });
    case "unfulfilled_seal_held":
      return json({ error: "seal_already_held" }, 409);
    case "fragments":
      if (product?.kind !== "fragments") throw new Error("ledger_fragments_for_unknown_product");
      return json({ status: "fragments", fragments: product.fragments, repeated });
    case "unfulfilled_price":
      return json({ error: "seal_price_not_for_holder" }, 409);
    case "unfulfilled_product":
      return json({ error: "unknown_product" }, 422);
    case "unfulfilled_deleted":
      return json({ error: "account_deleted" }, 410);
    case "pending_eligibility":
      return json({ error: "holdings_unavailable" }, 503);
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
