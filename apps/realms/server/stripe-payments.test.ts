import { afterEach, expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import type { FragmentCredit } from "./fragment-credit";
import { handleShopRefunded, handleShopRefunds } from "./fragment-payments";
import {
  handleStripeIntent,
  handleStripePayment,
  handleStripeWebhook,
  STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  verifyStripeSignature,
  type StripePaymentWorld,
} from "./stripe-payments";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

const OWNER = "0xa1";
const NOW = 1_700_000_000;
const CREDS = {
  secretKey: "sk_test_secret",
  webhookSecret: "whsec_test_secret",
  publishableKey: "pk_test_publishable",
};

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const signedIn = (realmsId: string) =>
  ({ api: { getSession: async () => ({ user: { realmsId } }) } }) as unknown as IdentityAuth;

async function signWebhook(payload: string, secret: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

const setup = async (enabled = true) => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  await db
    .prepare(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
       VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1)`,
    )
    .bind(OWNER)
    .run();
  const credits: FragmentCredit[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
    expect(init?.redirect).toBe("manual");
    expect(String(init?.body)).toContain("automatic_payment_methods%5Benabled%5D=true");
    return Response.json({ id: "pi_test_1", client_secret: "pi_test_1_secret_xyz" });
  });
  const world: StripePaymentWorld = {
    db,
    access: async () => true,
    credentials: enabled ? CREDS : null,
    creditFragments: async (credit) => {
      credits.push(credit);
      return Response.json({ id: "0x1" });
    },
    fetchImpl: fetchMock,
    now: () => NOW,
  };
  return { world, credits, fetchMock };
};

it("returns 503 stripe_disabled when Stripe env vars are not configured", async () => {
  const { world } = await setup(false);
  const intent = await handleStripeIntent(
    new Request("https://realms.test/api/shop/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ chain: "0x1", game: 7, fragments: 500 }),
    }),
    signedIn(OWNER),
    world,
  );
  expect(intent.status).toBe(503);
  expect(await intent.json()).toEqual({ error: "stripe_disabled" });

  const webhook = await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", { method: "POST", body: "{}" }),
    world,
  );
  expect(webhook.status).toBe(503);
  expect(await webhook.json()).toEqual({ error: "stripe_disabled" });
});

it("verifies HMAC-SHA256 stripe-signature and rejects bad or replayed signatures", async () => {
  const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } });
  const valid = await signWebhook(payload, CREDS.webhookSecret, NOW);
  expect(await verifyStripeSignature(payload, valid, CREDS.webhookSecret, NOW)).toBe(true);
  expect(await verifyStripeSignature(payload, valid, "wrong-secret", NOW)).toBe(false);
  expect(await verifyStripeSignature(payload + " ", valid, CREDS.webhookSecret, NOW)).toBe(false);
  const expired = await signWebhook(payload, CREDS.webhookSecret, NOW - STRIPE_WEBHOOK_TOLERANCE_SECONDS - 1);
  expect(await verifyStripeSignature(payload, expired, CREDS.webhookSecret, NOW)).toBe(false);
});

it("creates PaymentIntents with automatic_payment_methods and idempotently credits via VALUE_RELAY on webhook", async () => {
  const { world, credits, fetchMock } = await setup(true);
  const created = await handleStripeIntent(
    new Request("https://realms.test/api/shop/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ chain: "0x1", game: 7, fragments: 1_000 }),
    }),
    signedIn(OWNER),
    world,
  );
  expect(created.status).toBe(200);
  expect(await created.json()).toEqual({
    intentId: "pi_test_1",
    clientSecret: "pi_test_1_secret_xyz",
    fragments: 1_000,
    cents: 1_000,
  });
  expect(fetchMock).toHaveBeenCalledOnce();

  const eventPayload = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_test_1", amount_received: 1_000, currency: "usd" } },
  });
  const sig = await signWebhook(eventPayload, CREDS.webhookSecret, NOW);

  const badSig = await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=" + "0".repeat(64) },
      body: eventPayload,
    }),
    world,
  );
  expect(badSig.status).toBe(400);

  for (let delivery = 0; delivery < 2; delivery++) {
    const response = await handleStripeWebhook(
      new Request("https://realms.test/api/shop/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": sig },
        body: eventPayload,
      }),
      world,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  }
  expect(credits).toEqual([{ chainId: "0x1", gameId: 7, realmsId: OWNER, id: "stripe:pi_test_1", amount: 1_000 }]);
});

it("reserves daily cap while an intent is pending, ignores redeliveries on settled unfulfilled intents, and records refunds", async () => {
  const { world, credits } = await setup(true);
  const first = await handleStripeIntent(
    new Request("https://realms.test/api/shop/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ chain: "0x1", game: 7, fragments: 10_000 }),
    }),
    signedIn(OWNER),
    world,
  );
  expect(first.status).toBe(200);
  const second = await handleStripeIntent(
    new Request("https://realms.test/api/shop/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ chain: "0x1", game: 7, fragments: 100 }),
    }),
    signedIn(OWNER),
    world,
  );
  expect(second.status).toBe(429);
  expect(await second.json()).toEqual({ error: "daily_cap", remaining: 0 });

  const firstPayload = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_test_1", amount_received: 10_000, currency: "usd" } },
  });
  expect(
    (
      await handleStripeWebhook(
        new Request("https://realms.test/api/shop/stripe/webhook", {
          method: "POST",
          headers: { "stripe-signature": await signWebhook(firstPayload, CREDS.webhookSecret, NOW) },
          body: firstPayload,
        }),
        world,
      )
    ).status,
  ).toBe(200);

  await world.db
    .prepare(
      `INSERT INTO "stripe_payment_intents" ("intent_id", "owner", "chain_id", "game_id", "fragments", "cents", "status", "created_at")
       VALUES ('pi_cap_over', ?1, '0x1', 7, 100, 100, 'created', ?2)`,
    )
    .bind(OWNER, NOW)
    .run();
  const payload = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_cap_over", amount_received: 100, currency: "usd" } },
  });
  const sig = await signWebhook(payload, CREDS.webhookSecret, NOW);
  for (let delivery = 0; delivery < 2; delivery++) {
    const webhook = await handleStripeWebhook(
      new Request("https://realms.test/api/shop/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": sig },
        body: payload,
      }),
      world,
    );
    expect(webhook.status).toBe(200);
  }
  expect(credits).toHaveLength(1);
  const storedStatus = await world.db
    .prepare(`SELECT "status" FROM "stripe_payment_intents" WHERE "intent_id" = 'pi_cap_over'`)
    .first<string>("status");
  expect(storedStatus).toBe("unfulfilled_daily_cap");

  const refunds = (await (await handleShopRefunds(world.db)).json()) as {
    refunds: { rail: string; transactionHash: string; reason: string; wei: string }[];
  };
  expect(refunds.refunds).toEqual([
    expect.objectContaining({
      rail: "stripe",
      transactionHash: "pi_cap_over",
      reason: "unfulfilled_daily_cap",
      wei: "100",
    }),
  ]);
  const refunded = await handleShopRefunded(
    new Request("https://realms.test/api/operator/shop/refunds", {
      method: "POST",
      body: JSON.stringify({ transactionHash: "pi_cap_over", refundTransaction: "re_test_1" }),
    }),
    world.db,
  );
  expect(refunded.status).toBe(200);
  expect(((await (await handleShopRefunds(world.db)).json()) as { refunds: unknown[] }).refunds).toEqual([]);
});

it("records unfulfilled_deleted and queues an operator refund when the account is deleted before webhook arrival", async () => {
  const { world, credits } = await setup(true);
  const created = await handleStripeIntent(
    new Request("https://realms.test/api/shop/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ chain: "0x1", game: 7, fragments: 500 }),
    }),
    signedIn(OWNER),
    world,
  );
  expect(created.status).toBe(200);
  await world.db.prepare(`DELETE FROM "user" WHERE "realmsId" = ?`).bind(OWNER).run();

  const payload = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_test_1", amount_received: 500, currency: "usd" } },
  });
  const sig = await signWebhook(payload, CREDS.webhookSecret, NOW);
  const webhook = await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": sig },
      body: payload,
    }),
    world,
  );
  expect(webhook.status).toBe(200);
  expect(credits).toEqual([]);
  const refunds = (await (await handleShopRefunds(world.db)).json()) as {
    refunds: { rail: string; transactionHash: string; reason: string; owner: string | null; wei: string }[];
  };
  expect(refunds.refunds).toEqual([
    expect.objectContaining({
      rail: "stripe",
      transactionHash: "pi_test_1",
      reason: "unfulfilled_deleted",
      owner: null,
      wei: "500",
    }),
  ]);
});

it("settles a PaymentIntent that succeeds on a retry after payment_intent.payment_failed", async () => {
  const { world, credits } = await setup(true);
  const created = await handleStripeIntent(
    new Request("https://realms.test/api/shop/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ chain: "0x1", game: 7, fragments: 500 }),
    }),
    signedIn(OWNER),
    world,
  );
  expect(created.status).toBe(200);

  const failedPayload = JSON.stringify({
    type: "payment_intent.payment_failed",
    data: { object: { id: "pi_test_1" } },
  });
  expect(
    (
      await handleStripeWebhook(
        new Request("https://realms.test/api/shop/stripe/webhook", {
          method: "POST",
          headers: { "stripe-signature": await signWebhook(failedPayload, CREDS.webhookSecret, NOW) },
          body: failedPayload,
        }),
        world,
      )
    ).status,
  ).toBe(200);

  const succeededPayload = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_test_1", amount_received: 500, currency: "usd" } },
  });
  expect(
    (
      await handleStripeWebhook(
        new Request("https://realms.test/api/shop/stripe/webhook", {
          method: "POST",
          headers: { "stripe-signature": await signWebhook(succeededPayload, CREDS.webhookSecret, NOW + 10) },
          body: succeededPayload,
        }),
        world,
      )
    ).status,
  ).toBe(200);
  expect(credits).toEqual([{ chainId: "0x1", gameId: 7, realmsId: OWNER, id: "stripe:pi_test_1", amount: 500 }]);
});

it("polls Stripe credit delivery status across unauthorized, unknown, delivering, delivered, failed, and refund_due states", async () => {
  const { world } = await setup(true);
  let relayUp = false;
  world.creditFragments = async () => (relayUp ? Response.json({ id: "0x1" }) : new Response(null, { status: 503 }));

  const poll = (id: string, auth: IdentityAuth = signedIn(OWNER)) =>
    handleStripePayment(new Request(`https://realms.test/api/shop/stripe/intent/${id}`), auth, world);
  const signedOut = { api: { getSession: async () => null } } as unknown as IdentityAuth;

  expect((await poll("pi_test_1", signedOut)).status).toBe(401);
  expect((await poll("not-a-pi")).status).toBe(404);
  expect((await poll("pi_missing")).status).toBe(404);

  const created = await handleStripeIntent(
    new Request("https://realms.test/api/shop/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ chain: "0x1", game: 7, fragments: 500 }),
    }),
    signedIn(OWNER),
    world,
  );
  expect(created.status).toBe(200);
  expect((await poll("pi_test_1", signedIn("0xb2"))).status).toBe(404);

  const beforeWebhook = await poll("pi_test_1");
  expect([beforeWebhook.status, await beforeWebhook.json()]).toEqual([202, { state: "delivering" }]);

  const failedPayload = JSON.stringify({
    type: "payment_intent.payment_failed",
    data: { object: { id: "pi_test_1" } },
  });
  await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": await signWebhook(failedPayload, CREDS.webhookSecret, NOW) },
      body: failedPayload,
    }),
    world,
  );
  const failed = await poll("pi_test_1");
  expect([failed.status, await failed.json()]).toEqual([202, { state: "delivering" }]);

  await world.db
    .prepare(
      `INSERT INTO "stripe_payment_intents" ("intent_id", "owner", "chain_id", "game_id", "fragments", "cents", "status", "created_at")
       VALUES ('pi_canceled', ?1, '0x1', 7, 500, 500, 'created', ?2)`,
    )
    .bind(OWNER, NOW)
    .run();
  const canceledPayload = JSON.stringify({
    type: "payment_intent.canceled",
    data: { object: { id: "pi_canceled" } },
  });
  await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": await signWebhook(canceledPayload, CREDS.webhookSecret, NOW + 5) },
      body: canceledPayload,
    }),
    world,
  );
  const canceled = await poll("pi_canceled");
  expect([canceled.status, await canceled.json()]).toEqual([409, { error: "payment_refused" }]);

  const succeededPayload = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_test_1", amount_received: 500, currency: "usd" } },
  });
  await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": await signWebhook(succeededPayload, CREDS.webhookSecret, NOW + 10) },
      body: succeededPayload,
    }),
    world,
  );
  const queued = await poll("pi_test_1");
  expect([queued.status, await queued.json()]).toEqual([202, { state: "delivering", fragments: 500 }]);

  relayUp = true;
  await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": await signWebhook(succeededPayload, CREDS.webhookSecret, NOW + 20) },
      body: succeededPayload,
    }),
    world,
  );
  const delivered = await poll("pi_test_1");
  expect([delivered.status, await delivered.json()]).toEqual([200, { state: "delivered", fragments: 500 }]);

  await world.db
    .prepare(
      `INSERT INTO "stripe_payment_intents" ("intent_id", "owner", "chain_id", "game_id", "fragments", "cents", "status", "created_at")
       VALUES ('pi_underpaid', ?1, '0x1', 7, 500, 500, 'created', ?2)`,
    )
    .bind(OWNER, NOW)
    .run();
  const underpaidPayload = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_underpaid", amount_received: 100, currency: "usd" } },
  });
  await handleStripeWebhook(
    new Request("https://realms.test/api/shop/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": await signWebhook(underpaidPayload, CREDS.webhookSecret, NOW + 30) },
      body: underpaidPayload,
    }),
    world,
  );
  const refundDue = await poll("pi_underpaid");
  expect([refundDue.status, await refundDue.json()]).toEqual([
    409,
    { error: "refund_due", refund: { token: "usd", wei: "500" } },
  ]);
});
