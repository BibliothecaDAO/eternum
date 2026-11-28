import { FRAGMENT_CENTS, FRAGMENTS_A_DAY } from "@bibliothecadao/types";
import {
  assertAllowedEvmPaymentChain,
  EVM_PAYMENT_CHAIN_ID,
  evmPaymentRail,
  solanaPaymentRail,
  type EvmPaymentRail,
  type SolanaPaymentRail,
} from "@realms-world/chain";

import type { IdentityAuth } from "./auth";
import { evmRpcUrlOf, solanaRpcUrlOf, type IdentityEnv } from "./env";
import {
  evmQuoteCalldataSuffix,
  normalizeEvmTxHash,
  readEvmUsdcTransfer,
  type EvmTransferVerification,
} from "./evm-usdc";
import { creditFragmentsOf, type FragmentCredit } from "./fragment-credit";
import {
  deliverFragmentCredits,
  fragmentsReservedOn,
  PAYMENT_BODY_BYTES,
  paymentStatusResponse,
  settlePurchaseOutcome,
  UNSEEN_PAYMENT_SECONDS,
  type PaymentOutcome,
} from "./fragment-payments";
import { isFragmentAmount, QUOTE_SECONDS } from "./fragment-price";
import { json, readBody } from "./http";
import { authorizeShop, namedGame, type ShopAccess } from "./shop-game";
import {
  normalizeSolanaSignature,
  readSolanaRecentBlockhash,
  readSolanaUsdcTransfer,
  type SolanaTransferVerification,
} from "./solana-usdc";

const USDC_UNITS_PER_CENT = 10_000n;

type ExternalRail = "evm" | "solana";

export interface ExternalPaymentWorld {
  db: D1Database;
  access?: ShopAccess | undefined;
  evm: (EvmPaymentRail & { rpcUrl: string }) | null;
  solana: (SolanaPaymentRail & { rpcUrl: string }) | null;
  verifyEvm?: (options: {
    rpcUrl: string;
    chainId: number;
    usdc: string;
    treasury: string;
    quoteId: string;
    txHash: string;
  }) => Promise<EvmTransferVerification>;
  verifySolana?: (options: {
    rpcUrl: string;
    usdc: string;
    treasury: string;
    quoteId: string;
    signature: string;
  }) => Promise<SolanaTransferVerification>;
  readSolanaBlockhash?: (rpcUrl: string) => Promise<string>;
  creditFragments: (credit: FragmentCredit) => Promise<Response>;
  now: () => number;
}

interface ExternalQuoteRow {
  id: string;
  owner: string | null;
  chainId: string;
  gameId: number;
  fragments: number;
  cents: number;
  rail: ExternalRail;
  networkChainId: number | null;
  token: string;
  treasury: string;
  usdcUnits: string;
  expiresAt: number;
  createdAt: number;
  txHash: string | null;
  receipt: string | null;
  refused: number;
  payer: string | null;
  paidUnits: string | null;
}

const COLUMNS = `"id", "owner", "chain_id" AS "chainId", "game_id" AS "gameId", "fragments", "cents", "rail",
  "network_chain_id" AS "networkChainId", "token", "treasury", "usdc_units" AS "usdcUnits", "expires_at" AS "expiresAt",
  "created_at" AS "createdAt", "tx_hash" AS "txHash", "receipt", "refused", "payer", "paid_units" AS "paidUnits"`;

export const externalPaymentWorldOf = (
  env: Pick<IdentityEnv, "DB" | "ENVIRONMENT" | "EVM_RPC_URL" | "SOLANA_RPC_URL" | "VALUE_RELAY" | "OPERATOR_TOKEN">,
  access?: ShopAccess,
): ExternalPaymentWorld => {
  const evmRpcUrl = evmRpcUrlOf(env);
  const solanaRpcUrl = solanaRpcUrlOf(env);
  return {
    db: env.DB,
    access,
    evm: evmRpcUrl ? { ...evmPaymentRail(env.ENVIRONMENT), rpcUrl: evmRpcUrl } : null,
    solana: solanaRpcUrl ? { ...solanaPaymentRail(env.ENVIRONMENT), rpcUrl: solanaRpcUrl } : null,
    creditFragments: creditFragmentsOf(env),
    now: () => Math.floor(Date.now() / 1000),
  };
};

const externalReceiptId = (rail: ExternalRail, networkChainId: number | null, txHash: string): string =>
  rail === "evm" ? `evm:${networkChainId ?? EVM_PAYMENT_CHAIN_ID}:${txHash}` : `sol:${txHash}`;

export async function handleExternalQuote(
  request: Request,
  auth: IdentityAuth,
  world: ExternalPaymentWorld,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!world.access) return json({ error: "shop_unavailable" }, 503);
  const body = await readQuoteBody(request);
  if (!body) return json({ error: "invalid_quote_request" }, 400);
  const game = namedGame(body.chain, body.game);
  const seat = await authorizeShop(request, auth, world.access, game);
  if (seat instanceof Response) return seat;
  if (!isFragmentAmount(body.fragments)) return json({ error: "invalid_fragments" }, 400);
  const remaining = FRAGMENTS_A_DAY - (await fragmentsReservedOn(world.db, seat.owner, world.now()));
  if (body.fragments > remaining) return json({ error: "daily_cap", remaining: Math.max(remaining, 0) }, 429);
  if (body.rail === "evm") {
    if (body.networkChainId !== undefined) {
      try {
        assertAllowedEvmPaymentChain(body.networkChainId);
      } catch {
        return json({ error: "unsupported_chain" }, 400);
      }
    }
    if (!world.evm) return json({ error: "rail_disabled" }, 503);
    return json(await recordExternalQuote(world, seat.owner, game!, body.fragments, "evm", world.evm));
  }
  if (!world.solana) return json({ error: "rail_disabled" }, 503);
  let recentBlockhash: string;
  try {
    const readBlockhash = world.readSolanaBlockhash ?? readSolanaRecentBlockhash;
    recentBlockhash = await readBlockhash(world.solana.rpcUrl);
  } catch (error) {
    console.error("[shop] solana blockhash read failed", error);
    return json({ error: "solana_unavailable" }, 503);
  }
  return json(
    await recordExternalQuote(world, seat.owner, game!, body.fragments, "solana", world.solana, recentBlockhash),
  );
}

export async function handleExternalPay(
  request: Request,
  auth: IdentityAuth,
  world: ExternalPaymentWorld,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const owner = await signedInOwner(request, auth);
  if (!owner) return json({ error: "unauthorized" }, 401);
  const asked = await readPayBody(request);
  if (!asked) return json({ error: "invalid_payment" }, 400);
  const quote = await quoteById(world.db, asked.quoteId);
  if (!quote || quote.owner !== owner) return json({ error: "unknown_quote" }, 404);
  const normalizedHash = normalizeHashForRail(quote.rail, asked.txHash);
  if (!normalizedHash) return json({ error: "invalid_payment" }, 400);
  if (quote.txHash === normalizedHash) return answerFor(world, await confirmExternalPayment(world, quote));
  if (quote.txHash && !quote.refused) return json({ error: "quote_paid" }, 409);
  if (await quoteByHash(world.db, normalizedHash)) return json({ error: "transaction_used" }, 409);
  if (world.now() > quote.expiresAt) {
    const verification = await verifyExternalTransfer(world, quote, normalizedHash);
    if (verification.status === "pending") return json({ error: "quote_expired" }, 410);
  }
  if (!(await claimExternalQuote(world.db, quote, normalizedHash))) return json({ error: "quote_paid" }, 409);
  const claimed = await quoteById(world.db, quote.id);
  return answerFor(world, await confirmExternalPayment(world, claimed!));
}

export async function handleExternalPayment(
  request: Request,
  auth: IdentityAuth,
  world: ExternalPaymentWorld,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const owner = await signedInOwner(request, auth);
  if (!owner) return json({ error: "unauthorized" }, 401);
  const raw = decodeURIComponent(new URL(request.url).pathname.split("/").pop() ?? "");
  const txHash = normalizeEvmTxHash(raw) ?? normalizeSolanaSignature(raw);
  const quote = txHash ? await quoteByHash(world.db, txHash) : null;
  if (!quote || quote.owner !== owner) return json({ error: "unknown_payment" }, 404);
  return answerFor(world, quote);
}

export async function settleExternalPayments(world: ExternalPaymentWorld) {
  for (const quote of await unsettledExternalQuotes(world.db)) {
    try {
      const confirmed = await confirmExternalPayment(world, quote);
      if (!confirmed.refused && !(await outcomeOf(world.db, confirmed)) && isUnseen(world, confirmed)) {
        await refuse(world.db, confirmed.id);
      }
    } catch (error) {
      console.warn("[shop] an external USDC payment waits for the next minute", quote.rail, quote.txHash, error);
    }
  }
  await deliverFragmentCredits(world);
}

async function recordExternalQuote(
  world: ExternalPaymentWorld,
  owner: string,
  game: { chainId: string; gameId: number },
  fragments: number,
  rail: ExternalRail,
  config: EvmPaymentRail | SolanaPaymentRail,
  recentBlockhash: string | null = null,
) {
  const now = world.now();
  const cents = fragments * FRAGMENT_CENTS;
  const usdcUnits = (BigInt(cents) * USDC_UNITS_PER_CENT).toString();
  const id = crypto.randomUUID();
  const networkChainId = rail === "evm" ? (config as EvmPaymentRail).chainId : null;
  const expiresAt = now + QUOTE_SECONDS;
  await world.db
    .prepare(
      `INSERT INTO "external_payment_quotes" ("id", "owner", "chain_id", "game_id", "fragments", "cents", "rail",
       "network_chain_id", "token", "treasury", "usdc_units", "expires_at", "created_at")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      owner,
      game.chainId,
      game.gameId,
      fragments,
      cents,
      rail,
      networkChainId,
      config.usdc,
      config.treasury,
      usdcUnits,
      expiresAt,
      now,
    )
    .run();
  return {
    fragments,
    cents,
    quote: {
      id,
      rail,
      chainId: networkChainId,
      token: config.usdc,
      treasury: config.treasury,
      usdcUnits,
      memo: rail === "solana" ? id : evmQuoteCalldataSuffix(id),
      recentBlockhash,
      expiresAt,
    },
  };
}

async function confirmExternalPayment(world: ExternalPaymentWorld, quote: ExternalQuoteRow): Promise<ExternalQuoteRow> {
  if (!quote.txHash || !quote.receipt || quote.refused || (await outcomeOf(world.db, quote))) return quote;
  const verification = await verifyExternalTransfer(world, quote, quote.txHash);
  if (verification.status === "pending") return quote;
  if (verification.status === "reverted") {
    await refuse(world.db, quote.id);
    return { ...quote, refused: 1 };
  }
  const outcome = await externalPurchaseOutcome(world, quote, verification.paidUnits, verification.timestamp);
  await recordExternalPurchase(world.db, quote, verification, outcome, quote.receipt, world.now());
  if (outcome === "fragments") await deliverFragmentCredits(world, quote.receipt);
  return { ...quote, payer: verification.payer, paidUnits: verification.paidUnits.toString() };
}

async function verifyExternalTransfer(
  world: ExternalPaymentWorld,
  quote: ExternalQuoteRow,
  txHash: string,
): Promise<EvmTransferVerification | SolanaTransferVerification> {
  if (quote.rail === "evm") {
    if (!world.evm) throw new Error("evm_rail_disabled");
    const chainId = quote.networkChainId ?? EVM_PAYMENT_CHAIN_ID;
    assertAllowedEvmPaymentChain(chainId);
    const verify = world.verifyEvm ?? readEvmUsdcTransfer;
    return verify({
      rpcUrl: world.evm.rpcUrl,
      chainId,
      usdc: quote.token,
      treasury: quote.treasury,
      quoteId: quote.id,
      txHash,
    });
  }
  if (!world.solana) throw new Error("solana_rail_disabled");
  const verify = world.verifySolana ?? readSolanaUsdcTransfer;
  return verify({
    rpcUrl: world.solana.rpcUrl,
    usdc: quote.token,
    treasury: quote.treasury,
    quoteId: quote.id,
    signature: txHash,
  });
}

async function externalPurchaseOutcome(
  world: ExternalPaymentWorld,
  quote: ExternalQuoteRow,
  paidUnits: bigint,
  paidAt: number,
): Promise<PaymentOutcome> {
  return settlePurchaseOutcome(world.db, {
    owner: quote.owner,
    createdAt: quote.createdAt,
    expired: paidAt < quote.createdAt - 60 || paidAt > quote.expiresAt,
    paidEnough: paidUnits >= BigInt(quote.usdcUnits),
  });
}

const recordExternalPurchase = (
  db: D1Database,
  quote: ExternalQuoteRow,
  paid: { payer: string; paidUnits: bigint },
  outcome: PaymentOutcome,
  receipt: string,
  now: number,
) =>
  db.batch([
    db
      .prepare(`UPDATE "external_payment_quotes" SET "payer" = ?, "paid_units" = ? WHERE "id" = ?`)
      .bind(paid.payer, paid.paidUnits.toString(), quote.id),
    db
      .prepare(
        `INSERT INTO "store_receipts" ("receipt", "product", "received_at", "owner", "outcome") VALUES (?, ?, ?, ?, ?)
         ON CONFLICT ("receipt") DO NOTHING`,
      )
      .bind(receipt, quote.rail === "evm" ? "evm_usdc" : "solana_usdc", now, quote.owner, outcome),
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

const answerFor = (world: ExternalPaymentWorld, quote: ExternalQuoteRow) =>
  paymentStatusResponse(world.db, {
    receipt: quote.receipt,
    refused: Boolean(quote.refused),
    fragments: quote.fragments,
    refund: { token: quote.token, wei: quote.paidUnits },
  });

const outcomeOf = (db: D1Database, quote: ExternalQuoteRow) =>
  quote.receipt
    ? db
        .prepare(`SELECT "outcome" FROM "store_receipts" WHERE "receipt" = ?`)
        .bind(quote.receipt)
        .first<PaymentOutcome>("outcome")
    : Promise.resolve(null);

const quoteById = (db: D1Database, id: string) =>
  db.prepare(`SELECT ${COLUMNS} FROM "external_payment_quotes" WHERE "id" = ?`).bind(id).first<ExternalQuoteRow>();

const quoteByHash = (db: D1Database, txHash: string) =>
  db
    .prepare(`SELECT ${COLUMNS} FROM "external_payment_quotes" WHERE "tx_hash" = ?`)
    .bind(txHash)
    .first<ExternalQuoteRow>();

const unsettledExternalQuotes = async (db: D1Database) =>
  (
    await db
      .prepare(
        `SELECT ${COLUMNS} FROM "external_payment_quotes" q WHERE q."receipt" IS NOT NULL AND q."refused" = 0
         AND NOT EXISTS (SELECT 1 FROM "store_receipts" r WHERE r."receipt" = q."receipt")`,
      )
      .all<ExternalQuoteRow>()
  ).results;

const claimExternalQuote = async (db: D1Database, quote: ExternalQuoteRow, txHash: string) =>
  (
    await db
      .prepare(
        `UPDATE "external_payment_quotes" SET "tx_hash" = ?, "receipt" = ?, "refused" = 0 WHERE "id" = ?
         AND ("tx_hash" IS NULL OR "refused" = 1)`,
      )
      .bind(txHash, externalReceiptId(quote.rail, quote.networkChainId, txHash), quote.id)
      .run()
  ).meta.changes === 1;

const refuse = (db: D1Database, id: string) =>
  db
    .prepare(`UPDATE "external_payment_quotes" SET "refused" = 1, "tx_hash" = NULL, "receipt" = NULL WHERE "id" = ?`)
    .bind(id)
    .run();

const isUnseen = (world: ExternalPaymentWorld, quote: ExternalQuoteRow) =>
  world.now() > quote.expiresAt + UNSEEN_PAYMENT_SECONDS;

const normalizeHashForRail = (rail: ExternalRail, txHash: unknown): string | null =>
  rail === "evm" ? normalizeEvmTxHash(txHash) : normalizeSolanaSignature(txHash);

const signedInOwner = async (request: Request, auth: IdentityAuth) =>
  (await auth.api.getSession({ headers: request.headers }))?.user.realmsId ?? null;

async function readQuoteBody(request: Request): Promise<{
  chain: unknown;
  game: unknown;
  fragments: number;
  rail: ExternalRail;
  networkChainId?: number | undefined;
} | null> {
  try {
    const body = JSON.parse(await readBody(request, PAYMENT_BODY_BYTES)) as Record<string, unknown>;
    if (body.rail !== "evm" && body.rail !== "solana") return null;
    const fragments = Number(body.fragments);
    const networkChainId =
      body.networkChainId === undefined || body.networkChainId === null ? undefined : Number(body.networkChainId);
    if (networkChainId !== undefined && !Number.isSafeInteger(networkChainId)) return null;
    return { chain: body.chain, game: body.game, fragments, rail: body.rail, networkChainId };
  } catch {
    return null;
  }
}

async function readPayBody(request: Request): Promise<{ quoteId: string; txHash: string } | null> {
  try {
    const body = JSON.parse(await readBody(request, PAYMENT_BODY_BYTES)) as Record<string, unknown>;
    return typeof body.quoteId === "string" && typeof body.txHash === "string"
      ? { quoteId: body.quoteId, txHash: body.txHash }
      : null;
  } catch {
    return null;
  }
}
