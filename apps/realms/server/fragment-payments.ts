import { FRAGMENTS_A_DAY } from "@bibliothecadao/types";
import {
  isRevertedPayment,
  isSettledPayment,
  lordsPaidBy,
  valuePlaneAddress,
  type PaymentReceipt,
} from "@realms-world/chain";

import type { IdentityAuth } from "./auth";
import { readDefaultWallet } from "./default-wallets";
import { creditFragmentsOf, type FragmentCredit } from "./fragment-credit";
import type { IdentityEnv } from "./env";
import { json, readBody } from "./http";
import { readPaymentReceipt } from "./l2";
import { readLinkedWallet } from "./linked-wallet";

const DAY_SECONDS = 86_400;
const UNSEEN_PAYMENT_SECONDS = 3_600;
const BODY_BYTES = 1024;

export interface LordsPayee {
  token: string;
  treasury: string;
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
  now: () => number;
}

export const lordsPayeeOf = (env: Pick<IdentityEnv, "ENVIRONMENT">): LordsPayee => ({
  token: valuePlaneAddress("lords", env.ENVIRONMENT),
  treasury: valuePlaneAddress("treasury", env.ENVIRONMENT),
});

export const fragmentPaymentWorldOf = (
  env: Pick<IdentityEnv, "DB" | "ENVIRONMENT" | "L2_RPC_URL" | "VALUE_RELAY" | "OPERATOR_TOKEN">,
): FragmentPaymentWorld => ({
  db: env.DB,
  readReceipt: (transactionHash) => readPaymentReceipt(env, transactionHash),
  payersOf: async (realmsId) =>
    [(await readDefaultWallet(env.DB, realmsId))?.address, (await readLinkedWallet(env.DB, realmsId))?.address].filter(
      (address): address is string => Boolean(address),
    ),
  creditFragments: creditFragmentsOf(env),
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
  expiresAt: number;
  createdAt: number;
  transactionHash: string | null;
  refused: number;
  payers: string | null;
  paidWei: string | null;
}

type Outcome =
  | "fragments"
  | "unfulfilled_expired"
  | "unfulfilled_underpaid"
  | "unfulfilled_daily_cap"
  | "unfulfilled_deleted";

const QUOTE_COLUMNS = `"id", "owner", "chain_id" AS "chainId", "game_id" AS "gameId", "fragments", "lords_wei" AS "lordsWei",
  "token", "treasury", "expires_at" AS "expiresAt", "created_at" AS "createdAt", "transaction_hash" AS "transactionHash", "refused", "payers", "paid_wei" AS "paidWei"`;

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
  await deliverFragmentCredits(world);
}

export async function handleShopRefunds(db: D1Database) {
  const refunds = await db
    .prepare(
      `SELECT q."transaction_hash" AS "transactionHash", r."outcome" AS "reason", q."payer", q."token",
       q."paid_wei" AS "wei", q."owner", r."received_at" AS "receivedAt"
       FROM "store_receipts" r JOIN "fragment_quotes" q ON r."receipt" = 'lords:' || q."transaction_hash"
       WHERE r."outcome" LIKE 'unfulfilled%' AND q."refund_transaction" IS NULL ORDER BY r."received_at"`,
    )
    .all();
  return json({ refunds: refunds.results });
}

export async function handleShopRefunded(request: Request, db: D1Database) {
  const refund = await readRefund(request);
  if (!refund) return json({ error: "invalid_refund" }, 400);
  const owed = await db
    .prepare(
      `SELECT q."refund_transaction" AS "refundTransaction" FROM "fragment_quotes" q
       JOIN "store_receipts" r ON r."receipt" = 'lords:' || q."transaction_hash"
       WHERE q."transaction_hash" = ? AND r."outcome" LIKE 'unfulfilled%'`,
    )
    .bind(refund.transactionHash)
    .first<{ refundTransaction: string | null }>();
  if (!owed) return json({ error: "unknown_refund" }, 404);
  if (owed.refundTransaction && owed.refundTransaction !== refund.refundTransaction)
    return json({ error: "already_refunded", refundTransaction: owed.refundTransaction }, 409);
  await db
    .prepare(
      `UPDATE "fragment_quotes" SET "refund_transaction" = ? WHERE "transaction_hash" = ? AND "refund_transaction" IS NULL`,
    )
    .bind(refund.refundTransaction, refund.transactionHash)
    .run();
  return json({ refunded: refund.transactionHash, refundTransaction: refund.refundTransaction });
}

export const fragmentsBoughtOn = async (db: D1Database, owner: string, moment: number) =>
  (await db
    .prepare(
      `SELECT coalesce(sum(q."fragments"), 0) AS "bought" FROM "fragment_quotes" q
       WHERE q."owner" = ?1 AND q."transaction_hash" IS NOT NULL AND q."refused" = 0
       AND q."created_at" >= ?2 AND q."created_at" < ?2 + ?3
       AND NOT EXISTS (SELECT 1 FROM "store_receipts" r
         WHERE r."receipt" = 'lords:' || q."transaction_hash" AND r."outcome" <> 'fragments')`,
    )
    .bind(owner, moment - (moment % DAY_SECONDS), DAY_SECONDS)
    .first<number>("bought")) ?? 0;

async function confirmPayment(world: FragmentPaymentWorld, quote: Quote): Promise<Quote> {
  if (!quote.transactionHash || quote.refused || (await outcomeOf(world.db, quote))) return quote;
  const settled = await world.readReceipt(quote.transactionHash);
  if (!settled) return quote;
  if (isRevertedPayment(settled.receipt)) return refuse(world.db, quote.id).then(() => ({ ...quote, refused: 1 }));
  if (!isSettledPayment(settled.receipt)) return quote;
  const paid = paymentOf(quote, settled.receipt);
  if (!paid) return refuse(world.db, quote.id).then(() => ({ ...quote, refused: 1 }));
  const outcome = await purchaseOutcome(world, quote, paid.wei, settled.timestamp);
  await recordPurchase(world.db, quote, paid, outcome, world.now());
  if (outcome === "fragments") await deliverFragmentCredits(world, `lords:${quote.transactionHash}`);
  return { ...quote, paidWei: paid.wei.toString() };
}

function paymentOf(quote: Quote, receipt: PaymentReceipt) {
  for (const payer of (quote.payers ?? "").split(",").filter(Boolean)) {
    const wei = lordsPaidBy(receipt, { token: quote.token, treasury: quote.treasury, payers: [payer] });
    if (wei > 0n) return { payer, wei };
  }
  return null;
}

async function purchaseOutcome(
  world: FragmentPaymentWorld,
  quote: Quote,
  paid: bigint,
  paidAt: number,
): Promise<Outcome> {
  if (!quote.owner) return "unfulfilled_deleted";
  if (paidAt > quote.expiresAt) return "unfulfilled_expired";
  if (paid < BigInt(quote.lordsWei)) return "unfulfilled_underpaid";
  return (await fragmentsBoughtOn(world.db, quote.owner, quote.createdAt)) > FRAGMENTS_A_DAY
    ? "unfulfilled_daily_cap"
    : "fragments";
}

const recordPurchase = (
  db: D1Database,
  quote: Quote,
  paid: { payer: string; wei: bigint },
  outcome: Outcome,
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

async function deliverFragmentCredits(world: FragmentPaymentWorld, only?: string) {
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

async function answerFor(world: FragmentPaymentWorld, quote: Quote) {
  if (quote.refused) return json({ error: "payment_refused" }, 409);
  const outcome = await outcomeOf(world.db, quote);
  if (!outcome) return json({ state: "delivering" }, 202);
  if (outcome !== "fragments")
    return json({ error: "refund_due", refund: { token: quote.token, wei: quote.paidWei } }, 409);
  const delivered = await world.db
    .prepare(`SELECT "status" FROM "fragment_credits" WHERE "receipt" = ?`)
    .bind(`lords:${quote.transactionHash}`)
    .first<string>("status");
  return delivered === "delivered"
    ? json({ state: "delivered", fragments: quote.fragments }, 200)
    : json({ state: "delivering", fragments: quote.fragments }, 202);
}

const outcomeOf = (db: D1Database, quote: Quote) =>
  db
    .prepare(`SELECT "outcome" FROM "store_receipts" WHERE "receipt" = ?`)
    .bind(`lords:${quote.transactionHash}`)
    .first<Outcome>("outcome");

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
    const body = JSON.parse(await readBody(request, BODY_BYTES)) as Record<string, unknown>;
    const transactionHash = transactionSpelling(body.transactionHash);
    return typeof body.quoteId === "string" && transactionHash ? { quoteId: body.quoteId, transactionHash } : null;
  } catch {
    return null;
  }
};

const readRefund = async (request: Request) => {
  try {
    const body = JSON.parse(await readBody(request, BODY_BYTES)) as Record<string, unknown>;
    const transactionHash = transactionSpelling(body.transactionHash);
    const refundTransaction = transactionSpelling(body.refundTransaction);
    return transactionHash && refundTransaction ? { transactionHash, refundTransaction } : null;
  } catch {
    return null;
  }
};

const transactionSpelling = (value: unknown) =>
  typeof value === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(value) ? `0x${BigInt(value).toString(16)}` : null;
