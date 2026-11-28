import { FRAGMENT_CENTS, FRAGMENTS_A_DAY } from "@bibliothecadao/types";

import type { IdentityAuth } from "./auth";
import { stripeCredentialsOf, type IdentityEnv, type StripeCredentials } from "./env";
import { creditFragmentsOf, type FragmentCredit } from "./fragment-credit";
import {
  deliverFragmentCredits,
  fragmentsReservedOn,
  PAYMENT_BODY_BYTES,
  paymentStatusResponse,
  settlePurchaseOutcome,
  stripeIntentSpelling,
} from "./fragment-payments";
import { isFragmentAmount } from "./fragment-price";
import { json, readBody } from "./http";
import { authorizeShop, namedGame, type ShopAccess } from "./shop-game";

const STRIPE_INTENTS_URL = "https://api.stripe.com/v1/payment_intents";
const WEBHOOK_BODY_BYTES = 262_144;
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface StripePaymentWorld {
  db: D1Database;
  access?: ShopAccess | undefined;
  credentials: StripeCredentials | null;
  creditFragments: (credit: FragmentCredit) => Promise<Response>;
  fetchImpl?: typeof fetch | undefined;
  now: () => number;
}

interface StoredIntent {
  intentId: string;
  owner: string | null;
  chainId: string;
  gameId: number;
  fragments: number;
  cents: number;
  status: string;
}

export const stripePaymentWorldOf = (
  env: Pick<
    IdentityEnv,
    "DB" | "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET" | "STRIPE_PUBLISHABLE_KEY" | "VALUE_RELAY" | "OPERATOR_TOKEN"
  >,
  access?: ShopAccess,
): StripePaymentWorld => ({
  db: env.DB,
  access,
  credentials: stripeCredentialsOf(env),
  creditFragments: creditFragmentsOf(env),
  now: () => Math.floor(Date.now() / 1000),
});

export async function handleStripeIntent(
  request: Request,
  auth: IdentityAuth,
  world: StripePaymentWorld,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!world.credentials) return json({ error: "stripe_disabled" }, 503);
  if (!world.access) return json({ error: "shop_unavailable" }, 503);
  const body = await readIntentRequest(request);
  if (!body) return json({ error: "invalid_intent_request" }, 400);
  const game = namedGame(body.chain, body.game);
  const seat = await authorizeShop(request, auth, world.access, game);
  if (seat instanceof Response) return seat;
  if (!isFragmentAmount(body.fragments)) return json({ error: "invalid_fragments" }, 400);
  const remaining = FRAGMENTS_A_DAY - (await fragmentsReservedOn(world.db, seat.owner, world.now()));
  if (body.fragments > remaining) return json({ error: "daily_cap", remaining: Math.max(remaining, 0) }, 429);
  const cents = body.fragments * FRAGMENT_CENTS;
  let created: { id: string; client_secret: string };
  try {
    created = await createStripePaymentIntent(world.credentials.secretKey, {
      cents,
      owner: seat.owner,
      chainId: game!.chainId,
      gameId: game!.gameId,
      fragments: body.fragments,
      fetchImpl: world.fetchImpl,
    });
  } catch (error) {
    console.error("[shop] stripe payment intent creation failed", error);
    return json({ error: "stripe_unavailable" }, 503);
  }
  await world.db
    .prepare(
      `INSERT INTO "stripe_payment_intents" ("intent_id", "owner", "chain_id", "game_id", "fragments", "cents", "status", "created_at")
       VALUES (?, ?, ?, ?, ?, ?, 'created', ?)`,
    )
    .bind(created.id, seat.owner, game!.chainId, game!.gameId, body.fragments, cents, world.now())
    .run();
  return json({
    intentId: created.id,
    clientSecret: created.client_secret,
    fragments: body.fragments,
    cents,
  });
}

export async function handleStripePayment(
  request: Request,
  auth: IdentityAuth,
  world: StripePaymentWorld,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const owner = (await auth.api.getSession({ headers: request.headers }))?.user.realmsId ?? null;
  if (!owner) return json({ error: "unauthorized" }, 401);
  const raw = decodeURIComponent(new URL(request.url).pathname.slice("/api/shop/stripe/intent/".length));
  const intentId = stripeIntentSpelling(raw);
  const stored = intentId
    ? await world.db
        .prepare(
          `SELECT "intent_id" AS "intentId", "owner", "chain_id" AS "chainId", "game_id" AS "gameId", "fragments", "cents", "status"
           FROM "stripe_payment_intents" WHERE "intent_id" = ?`,
        )
        .bind(intentId)
        .first<StoredIntent>()
    : null;
  if (!stored || stored.owner !== owner) return json({ error: "unknown_payment" }, 404);
  return paymentStatusResponse(world.db, {
    receipt: `stripe:${stored.intentId}`,
    refused: stored.status === "canceled",
    fragments: stored.fragments,
    refund: { token: "usd", wei: String(stored.cents) },
  });
}

export async function handleStripeWebhook(request: Request, world: StripePaymentWorld): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!world.credentials) return json({ error: "stripe_disabled" }, 503);
  const signatureHeader = request.headers.get("stripe-signature");
  if (!signatureHeader) return json({ error: "invalid_signature" }, 400);
  let payload: string;
  try {
    payload = await readBody(request, WEBHOOK_BODY_BYTES);
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  const valid = await verifyStripeSignature(payload, signatureHeader, world.credentials.webhookSecret, world.now());
  if (!valid) return json({ error: "invalid_signature" }, 400);
  const event = parseStripeEvent(payload);
  if (!event) return json({ error: "invalid_payload" }, 400);
  if (event.type === "payment_intent.succeeded") {
    await settleSucceededIntent(world, event.object);
  } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    const status = event.type === "payment_intent.payment_failed" ? "failed" : "canceled";
    if (event.object.id) {
      await world.db
        .prepare(`UPDATE "stripe_payment_intents" SET "status" = ? WHERE "intent_id" = ? AND "status" = 'created'`)
        .bind(status, event.object.id)
        .run();
    }
  }
  return json({ received: true });
}

export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  nowSeconds: number,
): Promise<boolean> {
  const parts = parseSignatureHeader(header);
  if (!parts) return false;
  if (Math.abs(nowSeconds - parts.timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = await hmacSha256Hex(secret, `${parts.timestamp}.${payload}`);
  return parts.signatures.some((candidate) => constantTimeEqual(expected, candidate));
}

async function createStripePaymentIntent(
  secretKey: string,
  input: {
    cents: number;
    owner: string;
    chainId: string;
    gameId: number;
    fragments: number;
    fetchImpl?: typeof fetch | undefined;
  },
): Promise<{ id: string; client_secret: string }> {
  const form = new URLSearchParams({
    amount: String(input.cents),
    currency: "usd",
    "automatic_payment_methods[enabled]": "true",
    "metadata[owner]": input.owner,
    "metadata[chain_id]": input.chainId,
    "metadata[game_id]": String(input.gameId),
    "metadata[fragments]": String(input.fragments),
    "metadata[cents]": String(input.cents),
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(STRIPE_INTENTS_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("stripe_redirect_refused");
  if (!response.ok) throw new Error(`stripe_http_${response.status}`);
  const body = (await response.json()) as { id?: unknown; client_secret?: unknown };
  if (typeof body.id !== "string" || typeof body.client_secret !== "string") {
    throw new Error("stripe_invalid_intent_response");
  }
  return { id: body.id, client_secret: body.client_secret };
}

async function settleSucceededIntent(
  world: StripePaymentWorld,
  intentObj: { id?: string | undefined; amount_received?: number | undefined; currency?: string | undefined },
) {
  if (!intentObj.id) return;
  const stored = await world.db
    .prepare(
      `SELECT "intent_id" AS "intentId", "owner", "chain_id" AS "chainId", "game_id" AS "gameId", "fragments", "cents", "status", "created_at" AS "createdAt"
       FROM "stripe_payment_intents" WHERE "intent_id" = ?`,
    )
    .bind(intentObj.id)
    .first<StoredIntent & { createdAt: number }>();
  if (!stored) return;
  const receipt = `stripe:${stored.intentId}`;
  const existingReceipt = await world.db
    .prepare(`SELECT "outcome" FROM "store_receipts" WHERE "receipt" = ?`)
    .bind(receipt)
    .first<string>("outcome");
  if (existingReceipt) {
    if (existingReceipt === "fragments") await deliverFragmentCredits(world, receipt);
    return;
  }
  if (stored.status === "succeeded") {
    await deliverFragmentCredits(world, receipt);
    return;
  }
  if (stored.status.startsWith("unfulfilled_")) return;
  const paidEnough =
    typeof intentObj.amount_received === "number" &&
    intentObj.amount_received >= stored.cents &&
    intentObj.currency?.toLowerCase() === "usd";
  const outcome = await settlePurchaseOutcome(world.db, {
    owner: stored.owner,
    createdAt: stored.createdAt,
    expired: false,
    paidEnough,
    additionalFragments: stored.fragments,
  });
  const now = world.now();
  await world.db.batch([
    world.db
      .prepare(
        `UPDATE "stripe_payment_intents" SET "status" = ? WHERE "intent_id" = ? AND "status" IN ('created', 'failed', 'canceled')`,
      )
      .bind(outcome === "fragments" ? "succeeded" : outcome, stored.intentId),
    world.db
      .prepare(
        `INSERT INTO "store_receipts" ("receipt", "product", "received_at", "owner", "outcome") VALUES (?, 'stripe', ?, ?, ?)
         ON CONFLICT ("receipt") DO NOTHING`,
      )
      .bind(receipt, now, stored.owner, outcome),
    ...(outcome === "fragments" && stored.owner
      ? [
          world.db
            .prepare(
              `INSERT INTO "fragment_credits" ("receipt", "owner", "fragments", "created_at", "chain_id", "game_id")
               VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT ("receipt") DO NOTHING`,
            )
            .bind(receipt, stored.owner, stored.fragments, now, stored.chainId, stored.gameId),
        ]
      : []),
  ]);
  if (outcome === "fragments") await deliverFragmentCredits(world, receipt);
}

function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [rawKey, rawValue] = part.trim().split("=");
    if (!rawKey || !rawValue) continue;
    if (rawKey === "t" && /^\d+$/.test(rawValue)) timestamp = Number(rawValue);
    if (rawKey === "v1" && /^[0-9a-fA-F]{64}$/.test(rawValue)) signatures.push(rawValue.toLowerCase());
  }
  return timestamp !== null && signatures.length > 0 ? { timestamp, signatures } : null;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function readIntentRequest(
  request: Request,
): Promise<{ chain: unknown; game: unknown; fragments: number } | null> {
  try {
    const body = JSON.parse(await readBody(request, PAYMENT_BODY_BYTES)) as Record<string, unknown>;
    return { chain: body.chain, game: body.game, fragments: Number(body.fragments) };
  } catch {
    return null;
  }
}

function parseStripeEvent(payload: string): {
  type: string;
  object: { id?: string | undefined; amount_received?: number | undefined; currency?: string | undefined };
} | null {
  try {
    const parsed = JSON.parse(payload) as {
      type?: unknown;
      data?: { object?: { id?: unknown; amount_received?: unknown; currency?: unknown } };
    };
    if (typeof parsed.type !== "string" || !parsed.data?.object) return null;
    const obj = parsed.data.object;
    return {
      type: parsed.type,
      object: {
        id: typeof obj.id === "string" ? obj.id : undefined,
        amount_received: typeof obj.amount_received === "number" ? obj.amount_received : undefined,
        currency: typeof obj.currency === "string" ? obj.currency : undefined,
      },
    };
  } catch {
    return null;
  }
}
