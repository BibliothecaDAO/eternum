import { FRAGMENTS_A_DAY } from "@bibliothecadao/types";
import {
  isRevertedPayment,
  isSettledPayment,
  lordsSplitPaidBy,
  valuePlaneAddress,
  type PaymentReceipt,
} from "@realms-world/chain";

import type { IdentityAuth } from "./auth";
import { readDefaultWallet } from "./default-wallets";
import { creditFragmentsOf, type FragmentCredit } from "./fragment-credit";
import { evmRpcUrlOf, solanaRpcUrlOf, type IdentityEnv } from "./env";
import { normalizeEvmTxHash } from "./evm-usdc";
import { externalPaymentWorldOf, settleExternalPayments } from "./external-payments";
import { json, readBody } from "./http";
import { readPaymentReceipt } from "./l2";
import { readLinkedWallet } from "./linked-wallet";
import { normalizeSolanaSignature } from "./solana-usdc";

const DAY_SECONDS = 86_400;
export const UNSEEN_PAYMENT_SECONDS = 3_600;
export const PAYMENT_BODY_BYTES = 1024;

export interface LordsPayee {
  token: string;
  treasury: string;
  veLords: string;
}

export interface SettledReceipt {
  receipt: PaymentReceipt;
  timestamp: number;
}

export interface FragmentPaymentWorld {
  db: D1Database;
  readReceipt: (transactionHash: string) => Promise<SettledReceipt | null>;
  payersOf: (realmsId: string) => Promise<string[]>;
  creditFragments: (credit: FragmentCredit) => Promise<Response>;
  settleExternal?: (() => Promise<void>) | undefined;
  now: () => number;
}

export const lordsPayeeOf = (env: Pick<IdentityEnv, "ENVIRONMENT">): LordsPayee => ({
  token: valuePlaneAddress("lords", env.ENVIRONMENT),
  treasury: valuePlaneAddress("treasury", env.ENVIRONMENT),
  veLords: valuePlaneAddress("veLords", env.ENVIRONMENT),
});

export const fragmentPaymentWorldOf = (
  env: Pick<
    IdentityEnv,
    "DB" | "ENVIRONMENT" | "L2_RPC_URL" | "VALUE_RELAY" | "OPERATOR_TOKEN" | "EVM_RPC_URL" | "SOLANA_RPC_URL"
  >,
): FragmentPaymentWorld => ({
  db: env.DB,
  readReceipt: (transactionHash) => readPaymentReceipt(env, transactionHash),
  payersOf: async (realmsId) =>
    [(await readDefaultWallet(env.DB, realmsId))?.address, (await readLinkedWallet(env.DB, realmsId))?.address].filter(
      (address): address is string => Boolean(address),
    ),
  creditFragments: creditFragmentsOf(env),
  settleExternal:
    evmRpcUrlOf(env) || solanaRpcUrlOf(env) ? () => settleExternalPayments(externalPaymentWorldOf(env)) : undefined,
  now: () => Math.floor(Date.now() / 1000),
});

interface Quote {
  id: string;
  owner: string | null;
  chainId: string;
  gameId: number;
  fragments: number;
  lordsWei: string;
  token: string;
  treasury: string;
  treasuryWei: string;
  veLords: string;
  veLordsWei: string;
  expiresAt: number;
  createdAt: number;
  transactionHash: string | null;
  refused: number;
  payers: string | null;
  paidWei: string | null;
}

export type PaymentOutcome =
  | "fragments"
  | "unfulfilled_expired"
  | "unfulfilled_underpaid"
  | "unfulfilled_daily_cap"
  | "unfulfilled_deleted";

const QUOTE_COLUMNS = `"id", "owner", "chain_id" AS "chainId", "game_id" AS "gameId", "fragments", "lords_wei" AS "lordsWei",
  "token", "treasury", "treasury_wei" AS "treasuryWei", "ve_lords" AS "veLords", "ve_lords_wei" AS "veLordsWei",
  "expires_at" AS "expiresAt", "created_at" AS "createdAt", "transaction_hash" AS "transactionHash", "refused", "payers", "paid_wei" AS "paidWei"`;

export async function handleFragmentPay(request: Request, auth: IdentityAuth, world: FragmentPaymentWorld) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const owner = await signedInOwner(request, auth);
  if (!owner) return json({ error: "unauthorized" }, 401);
  const asked = await readPayment(request);
  if (!asked) return json({ error: "invalid_payment" }, 400);
  const quote = await quoteById(world.db, asked.quoteId);
  if (!quote || quote.owner !== owner) return json({ error: "unknown_quote" }, 404);
  if (quote.transactionHash === asked.transactionHash) return answerFor(world, await confirmPayment(world, quote));
  if (quote.transactionHash && !quote.refused) return json({ error: "quote_paid" }, 409);
  if (await quoteByTransaction(world.db, asked.transactionHash)) return json({ error: "transaction_used" }, 409);
  if (world.now() > quote.expiresAt && !(await world.readReceipt(asked.transactionHash)))
    return json({ error: "quote_expired" }, 410);
  const payers = await world.payersOf(owner);
  if (!(await claimQuote(world.db, quote.id, asked.transactionHash, payers))) return json({ error: "quote_paid" }, 409);
  const claimed = await quoteById(world.db, quote.id);
  return answerFor(world, await confirmPayment(world, claimed!));
}

export async function handleFragmentPayment(request: Request, auth: IdentityAuth, world: FragmentPaymentWorld) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const owner = await signedInOwner(request, auth);
  if (!owner) return json({ error: "unauthorized" }, 401);
  const transactionHash = transactionSpelling(new URL(request.url).pathname.split("/").pop());
  const quote = transactionHash ? await quoteByTransaction(world.db, transactionHash) : null;
  if (!quote || quote.owner !== owner) return json({ error: "unknown_payment" }, 404);
  return answerFor(world, quote);
}

export async function settleFragmentPayments(world: FragmentPaymentWorld) {
  for (const quote of await unsettledQuotes(world.db)) {
    try {
      const confirmed = await confirmPayment(world, quote);
      if (!confirmed.refused && !(await outcomeOf(world.db, confirmed)) && isUnseen(world, confirmed))
        await refuse(world.db, confirmed.id);
    } catch (error) {
      console.warn("[shop] a LORDS payment waits for the next minute", quote.transactionHash, error);
    }
  }
  if (world.settleExternal) await world.settleExternal();
  await deliverFragmentCredits(world);
}

export async function handleShopRefunds(db: D1Database) {
  const refunds = await db
    .prepare(
      `SELECT 'lords' AS "rail", q."transaction_hash" AS "transactionHash", r."outcome" AS "reason", q."payer", q."token",
       q."paid_wei" AS "wei", q."owner", r."received_at" AS "receivedAt"
       FROM "store_receipts" r JOIN "fragment_quotes" q ON r."receipt" = 'lords:' || q."transaction_hash"
       WHERE r."outcome" LIKE 'unfulfilled%' AND q."refund_transaction" IS NULL
       UNION ALL
       SELECT q."rail" AS "rail", q."tx_hash" AS "transactionHash", r."outcome" AS "reason", q."payer", q."token",
       q."paid_units" AS "wei", q."owner", r."received_at" AS "receivedAt"
        FROM "store_receipts" r JOIN "external_payment_quotes" q ON r."receipt" = q."receipt"
        WHERE r."outcome" LIKE 'unfulfilled%' AND q."refund_transaction" IS NULL
       UNION ALL
       SELECT 'stripe' AS "rail", s."intent_id" AS "transactionHash", r."outcome" AS "reason", s."owner" AS "payer", 'usd' AS "token",
       CAST(s."cents" AS TEXT) AS "wei", s."owner", r."received_at" AS "receivedAt"
       FROM "store_receipts" r JOIN "stripe_payment_intents" s ON r."receipt" = 'stripe:' || s."intent_id"
       WHERE r."outcome" LIKE 'unfulfilled%' AND s."refund_id" IS NULL
       ORDER BY "receivedAt"`,
    )
    .all();
  return json({ refunds: refunds.results });
}

export async function handleShopRefunded(request: Request, db: D1Database) {
  const refund = await readRefund(request);
  if (!refund) return json({ error: "invalid_refund" }, 400);
  const starknet = await recordLordsRefund(db, refund);
  if (starknet) return starknet;
  const external = await recordExternalRefund(db, refund);
  if (external) return external;
  const stripe = await recordStripeRefund(db, refund);
  if (stripe) return stripe;
  return json({ error: "unknown_refund" }, 404);
}

async function recordLordsRefund(db: D1Database, refund: { transactionHash: string; refundTransaction: string }) {
  const txHash = transactionSpelling(refund.transactionHash);
  const refundTx = transactionSpelling(refund.refundTransaction);
  if (!txHash || !refundTx) return null;
  const owed = await db
    .prepare(
      `SELECT q."refund_transaction" AS "refundTransaction" FROM "fragment_quotes" q
       JOIN "store_receipts" r ON r."receipt" = 'lords:' || q."transaction_hash"
       WHERE q."transaction_hash" = ? AND r."outcome" LIKE 'unfulfilled%'`,
    )
    .bind(txHash)
    .first<{ refundTransaction: string | null }>();
  if (!owed) return null;
  if (owed.refundTransaction && owed.refundTransaction !== refundTx)
    return json({ error: "already_refunded", refundTransaction: owed.refundTransaction }, 409);
  await db
    .prepare(
      `UPDATE "fragment_quotes" SET "refund_transaction" = ? WHERE "transaction_hash" = ? AND "refund_transaction" IS NULL`,
    )
    .bind(refundTx, txHash)
    .run();
  return json({ refunded: txHash, refundTransaction: refundTx });
}

async function recordExternalRefund(db: D1Database, refund: { transactionHash: string; refundTransaction: string }) {
  const txHash = externalReferenceSpelling(refund.transactionHash);
  const refundTx = externalReferenceSpelling(refund.refundTransaction);
  if (!txHash || !refundTx) return null;
  const owed = await db
    .prepare(
      `SELECT q."refund_transaction" AS "refundTransaction" FROM "external_payment_quotes" q
       JOIN "store_receipts" r ON r."receipt" = q."receipt"
       WHERE q."tx_hash" = ? AND r."outcome" LIKE 'unfulfilled%'`,
    )
    .bind(txHash)
    .first<{ refundTransaction: string | null }>();
  if (!owed) return null;
  if (owed.refundTransaction && owed.refundTransaction !== refundTx)
    return json({ error: "already_refunded", refundTransaction: owed.refundTransaction }, 409);
  await db
    .prepare(
      `UPDATE "external_payment_quotes" SET "refund_transaction" = ? WHERE "tx_hash" = ? AND "refund_transaction" IS NULL`,
    )
    .bind(refundTx, txHash)
    .run();
  return json({ refunded: txHash, refundTransaction: refundTx });
}

async function recordStripeRefund(db: D1Database, refund: { transactionHash: string; refundTransaction: string }) {
  const intentId = stripeIntentSpelling(refund.transactionHash);
  const refundId = stripeRefundSpelling(refund.refundTransaction);
  if (!intentId || !refundId) return null;
  const owed = await db
    .prepare(
      `SELECT s."refund_id" AS "refundId" FROM "stripe_payment_intents" s
       JOIN "store_receipts" r ON r."receipt" = 'stripe:' || s."intent_id"
       WHERE s."intent_id" = ? AND r."outcome" LIKE 'unfulfilled%'`,
    )
    .bind(intentId)
    .first<{ refundId: string | null }>();
  if (!owed) return null;
  if (owed.refundId && owed.refundId !== refundId)
    return json({ error: "already_refunded", refundTransaction: owed.refundId }, 409);
  await db
    .prepare(`UPDATE "stripe_payment_intents" SET "refund_id" = ? WHERE "intent_id" = ? AND "refund_id" IS NULL`)
    .bind(refundId, intentId)
    .run();
  return json({ refunded: intentId, refundTransaction: refundId });
}

const STRIPE_RESERVATION_SECONDS = 600;

const fragmentsBoughtOn = async (db: D1Database, owner: string, moment: number) => {
  const dayStart = moment - (moment % DAY_SECONDS);
  const [lords, external, stripe] = await Promise.all([
    db
      .prepare(
        `SELECT coalesce(sum(q."fragments"), 0) AS "bought" FROM "fragment_quotes" q
         WHERE q."owner" = ?1 AND q."transaction_hash" IS NOT NULL AND q."refused" = 0
         AND q."created_at" >= ?2 AND q."created_at" < ?2 + ?3
         AND NOT EXISTS (SELECT 1 FROM "store_receipts" r
           WHERE r."receipt" = 'lords:' || q."transaction_hash" AND r."outcome" <> 'fragments')`,
      )
      .bind(owner, dayStart, DAY_SECONDS)
      .first<number>("bought"),
    db
      .prepare(
        `SELECT coalesce(sum(q."fragments"), 0) AS "bought" FROM "external_payment_quotes" q
         WHERE q."owner" = ?1 AND q."receipt" IS NOT NULL AND q."refused" = 0
         AND q."created_at" >= ?2 AND q."created_at" < ?2 + ?3
         AND NOT EXISTS (SELECT 1 FROM "store_receipts" r
           WHERE r."receipt" = q."receipt" AND r."outcome" <> 'fragments')`,
      )
      .bind(owner, dayStart, DAY_SECONDS)
      .first<number>("bought"),
    db
      .prepare(
        `SELECT coalesce(sum("fragments"), 0) AS "bought" FROM "stripe_payment_intents"
         WHERE "owner" = ?1 AND "created_at" >= ?2 AND "created_at" < ?2 + ?3 AND "status" = 'succeeded'`,
      )
      .bind(owner, dayStart, DAY_SECONDS)
      .first<number>("bought"),
  ]);
  return (lords ?? 0) + (external ?? 0) + (stripe ?? 0);
};

export const fragmentsReservedOn = async (db: D1Database, owner: string, moment: number) => {
  const dayStart = moment - (moment % DAY_SECONDS);
  const [bought, pendingStripe] = await Promise.all([
    fragmentsBoughtOn(db, owner, moment),
    db
      .prepare(
        `SELECT coalesce(sum("fragments"), 0) AS "pending" FROM "stripe_payment_intents"
         WHERE "owner" = ?1 AND "created_at" >= ?2 AND "created_at" < ?2 + ?3
         AND "status" = 'created' AND "created_at" > ?4`,
      )
      .bind(owner, dayStart, DAY_SECONDS, moment - STRIPE_RESERVATION_SECONDS)
      .first<number>("pending"),
  ]);
  return bought + (pendingStripe ?? 0);
};

async function confirmPayment(world: FragmentPaymentWorld, quote: Quote): Promise<Quote> {
  if (!quote.transactionHash || quote.refused || (await outcomeOf(world.db, quote))) return quote;
  const settled = await world.readReceipt(quote.transactionHash);
  if (!settled) return quote;
  if (isRevertedPayment(settled.receipt)) return refuse(world.db, quote.id).then(() => ({ ...quote, refused: 1 }));
  if (!isSettledPayment(settled.receipt)) return quote;
  const paid = paymentOf(quote, settled.receipt);
  if (!paid) return refuse(world.db, quote.id).then(() => ({ ...quote, refused: 1 }));
  const outcome = await purchaseOutcome(world, quote, paid, settled.timestamp);
  await recordPurchase(world.db, quote, paid, outcome, world.now());
  if (outcome === "fragments") await deliverFragmentCredits(world, `lords:${quote.transactionHash}`);
  return { ...quote, paidWei: paid.wei.toString() };
}

interface VerifiedLordsPayment {
  payer: string;
  wei: bigint;
  treasuryWei: bigint;
  veLordsWei: bigint;
}

function paymentOf(quote: Quote, receipt: PaymentReceipt): VerifiedLordsPayment | null {
  for (const payer of (quote.payers ?? "").split(",").filter(Boolean)) {
    const split = lordsSplitPaidBy(receipt, {
      token: quote.token,
      treasury: quote.treasury,
      veLords: quote.veLords,
      payers: [payer],
    });
    if (split.totalWei > 0n) {
      return { payer, wei: split.totalWei, treasuryWei: split.treasuryWei, veLordsWei: split.veLordsWei };
    }
  }
  return null;
}

export async function settlePurchaseOutcome(
  db: D1Database,
  input: {
    owner: string | null;
    createdAt: number;
    expired: boolean;
    paidEnough: boolean;
    additionalFragments?: number;
  },
): Promise<PaymentOutcome> {
  if (!input.owner) return "unfulfilled_deleted";
  if (input.expired) return "unfulfilled_expired";
  if (!input.paidEnough) return "unfulfilled_underpaid";
  const bought = await fragmentsBoughtOn(db, input.owner, input.createdAt);
  return bought + (input.additionalFragments ?? 0) > FRAGMENTS_A_DAY ? "unfulfilled_daily_cap" : "fragments";
}

async function purchaseOutcome(
  world: FragmentPaymentWorld,
  quote: Quote,
  paid: VerifiedLordsPayment,
  paidAt: number,
): Promise<PaymentOutcome> {
  return settlePurchaseOutcome(world.db, {
    owner: quote.owner,
    createdAt: quote.createdAt,
    expired: paidAt > quote.expiresAt,
    paidEnough: paid.treasuryWei >= BigInt(quote.treasuryWei) && paid.veLordsWei >= BigInt(quote.veLordsWei),
  });
}

const recordPurchase = (
  db: D1Database,
  quote: Quote,
  paid: { payer: string; wei: bigint },
  outcome: PaymentOutcome,
  now: number,
) => {
  const receipt = `lords:${quote.transactionHash}`;
  return db.batch([
    db
      .prepare(`UPDATE "fragment_quotes" SET "payer" = ?, "paid_wei" = ? WHERE "id" = ?`)
      .bind(paid.payer, paid.wei.toString(), quote.id),
    db
      .prepare(
        `INSERT INTO "store_receipts" ("receipt", "product", "received_at", "owner", "outcome") VALUES (?, 'lords', ?, ?, ?)
         ON CONFLICT ("receipt") DO NOTHING`,
      )
      .bind(receipt, now, quote.owner, outcome),
    ...(outcome === "fragments"
      ? [
          db
            .prepare(
              `INSERT INTO "fragment_credits" ("receipt", "owner", "fragments", "created_at", "chain_id", "game_id")
               VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT ("receipt") DO NOTHING`,
            )
            .bind(receipt, quote.owner, quote.fragments, now, quote.chainId, quote.gameId),
        ]
      : []),
  ]);
};

export async function deliverFragmentCredits(
  world: Pick<FragmentPaymentWorld, "db" | "creditFragments">,
  only?: string,
) {
  const pending = await world.db
    .prepare(
      `SELECT "receipt", "owner", "fragments", "chain_id" AS "chainId", "game_id" AS "gameId" FROM "fragment_credits"
       WHERE "status" = 'pending' AND "chain_id" IS NOT NULL AND (?1 IS NULL OR "receipt" = ?1) ORDER BY "created_at"`,
    )
    .bind(only ?? null)
    .all<{ receipt: string; owner: string; fragments: number; chainId: string; gameId: number }>();
  for (const credit of pending.results) {
    const sent = await world
      .creditFragments({
        chainId: credit.chainId,
        gameId: credit.gameId,
        realmsId: credit.owner,
        id: credit.receipt,
        amount: credit.fragments,
      })
      .catch(() => null);
    if (sent?.ok)
      await world.db
        .prepare(`UPDATE "fragment_credits" SET "status" = 'delivered' WHERE "receipt" = ?`)
        .bind(credit.receipt)
        .run();
  }
}

export async function paymentStatusResponse(
  db: D1Database,
  input: {
    receipt: string | null;
    refused: boolean;
    fragments: number;
    refund: { token: string; wei: string | null };
  },
): Promise<Response> {
  const outcome = input.receipt
    ? await db
        .prepare(`SELECT "outcome" FROM "store_receipts" WHERE "receipt" = ?`)
        .bind(input.receipt)
        .first<PaymentOutcome>("outcome")
    : null;
  if (outcome) {
    if (outcome !== "fragments") return json({ error: "refund_due", refund: input.refund }, 409);
    const delivered = await db
      .prepare(`SELECT "status" FROM "fragment_credits" WHERE "receipt" = ?`)
      .bind(input.receipt!)
      .first<string>("status");
    return delivered === "delivered"
      ? json({ state: "delivered", fragments: input.fragments }, 200)
      : json({ state: "delivering", fragments: input.fragments }, 202);
  }
  if (input.refused) return json({ error: "payment_refused" }, 409);
  return json({ state: "delivering" }, 202);
}

const answerFor = (world: FragmentPaymentWorld, quote: Quote) =>
  paymentStatusResponse(world.db, {
    receipt: quote.transactionHash ? `lords:${quote.transactionHash}` : null,
    refused: Boolean(quote.refused),
    fragments: quote.fragments,
    refund: { token: quote.token, wei: quote.paidWei },
  });

const outcomeOf = (db: D1Database, quote: Quote) =>
  db
    .prepare(`SELECT "outcome" FROM "store_receipts" WHERE "receipt" = ?`)
    .bind(`lords:${quote.transactionHash}`)
    .first<PaymentOutcome>("outcome");

const quoteById = (db: D1Database, id: string) =>
  db.prepare(`SELECT ${QUOTE_COLUMNS} FROM "fragment_quotes" WHERE "id" = ?`).bind(id).first<Quote>();

const quoteByTransaction = (db: D1Database, transactionHash: string) =>
  db
    .prepare(`SELECT ${QUOTE_COLUMNS} FROM "fragment_quotes" WHERE "transaction_hash" = ?`)
    .bind(transactionHash)
    .first<Quote>();

const unsettledQuotes = async (db: D1Database) =>
  (
    await db
      .prepare(
        `SELECT ${QUOTE_COLUMNS} FROM "fragment_quotes" q WHERE "transaction_hash" IS NOT NULL AND "refused" = 0
         AND NOT EXISTS (SELECT 1 FROM "store_receipts" r WHERE r."receipt" = 'lords:' || q."transaction_hash")`,
      )
      .all<Quote>()
  ).results;

const claimQuote = async (db: D1Database, id: string, transactionHash: string, payers: readonly string[]) =>
  (
    await db
      .prepare(
        `UPDATE "fragment_quotes" SET "transaction_hash" = ?, "refused" = 0, "payers" = ? WHERE "id" = ?
         AND ("transaction_hash" IS NULL OR "refused" = 1)`,
      )
      .bind(transactionHash, payers.join(","), id)
      .run()
  ).meta.changes === 1;

const refuse = (db: D1Database, id: string) =>
  db.prepare(`UPDATE "fragment_quotes" SET "refused" = 1, "transaction_hash" = NULL WHERE "id" = ?`).bind(id).run();

const isUnseen = (world: FragmentPaymentWorld, quote: Quote) => world.now() > quote.expiresAt + UNSEEN_PAYMENT_SECONDS;

const signedInOwner = async (request: Request, auth: IdentityAuth) =>
  (await auth.api.getSession({ headers: request.headers }))?.user.realmsId ?? null;

const readPayment = async (request: Request) => {
  try {
    const body = JSON.parse(await readBody(request, PAYMENT_BODY_BYTES)) as Record<string, unknown>;
    const transactionHash = transactionSpelling(body.transactionHash);
    return typeof body.quoteId === "string" && transactionHash ? { quoteId: body.quoteId, transactionHash } : null;
  } catch {
    return null;
  }
};

const readRefund = async (request: Request) => {
  try {
    const body = JSON.parse(await readBody(request, PAYMENT_BODY_BYTES)) as Record<string, unknown>;
    const transactionHash = refundReferenceSpelling(body.transactionHash);
    const refundTransaction = refundReferenceSpelling(body.refundTransaction);
    return transactionHash && refundTransaction ? { transactionHash, refundTransaction } : null;
  } catch {
    return null;
  }
};

const transactionSpelling = (value: unknown) =>
  typeof value === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(value) ? `0x${BigInt(value).toString(16)}` : null;

const externalReferenceSpelling = (value: unknown) => normalizeEvmTxHash(value) ?? normalizeSolanaSignature(value);

export const stripeIntentSpelling = (value: unknown) =>
  typeof value === "string" && /^pi_[A-Za-z0-9_]+$/.test(value) ? value : null;

const stripeRefundSpelling = (value: unknown) =>
  typeof value === "string" && /^re_[A-Za-z0-9_]+$/.test(value) ? value : null;

const stripeReferenceSpelling = (value: unknown) => stripeIntentSpelling(value) ?? stripeRefundSpelling(value);

const refundReferenceSpelling = (value: unknown) =>
  externalReferenceSpelling(value) ?? transactionSpelling(value) ?? stripeReferenceSpelling(value);
