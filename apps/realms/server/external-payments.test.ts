import { afterEach, expect, it } from "vitest";
import { evmPaymentRail, solanaPaymentRail } from "@realms-world/chain";

import type { IdentityAuth } from "./auth";
import type { FragmentCredit } from "./fragment-credit";
import {
  handleExternalPay,
  handleExternalPayment,
  handleExternalQuote,
  settleExternalPayments,
  type ExternalPaymentWorld,
} from "./external-payments";
import { evmQuoteCalldataSuffix, type EvmTransferVerification } from "./evm-usdc";
import { handleShopRefunded, handleShopRefunds } from "./fragment-payments";
import type { SolanaTransferVerification } from "./solana-usdc";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

const OWNER = "0xa1";
const OTHER = "0xb2";
const NOW = 1_000_000;
const EVM_RAIL = { ...evmPaymentRail("production"), rpcUrl: "https://eth.example" };
const SOL_RAIL = { ...solanaPaymentRail("production"), rpcUrl: "https://sol.example" };
const EVM_HASH = `0x${"cd".repeat(32)}`;
const SOL_SIG = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
const SOL_BLOCKHASH = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi";

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const signedIn = (realmsId: string) =>
  ({ api: { getSession: async () => ({ user: { realmsId } }) } }) as unknown as IdentityAuth;

const harness = async (options: { evmEnabled?: boolean; solanaEnabled?: boolean } = {}) => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  for (const realmsId of [OWNER, OTHER]) {
    await db
      .prepare(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
         VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1)`,
      )
      .bind(realmsId)
      .run();
  }
  const evmAnswers = new Map<string, EvmTransferVerification>();
  const solAnswers = new Map<string, SolanaTransferVerification>();
  const credits: FragmentCredit[] = [];
  let relayUp = true;
  const world: ExternalPaymentWorld = {
    db,
    access: async () => true,
    evm: options.evmEnabled === false ? null : EVM_RAIL,
    solana: options.solanaEnabled === false ? null : SOL_RAIL,
    verifyEvm: async ({ txHash }) => evmAnswers.get(txHash) ?? { status: "pending" },
    verifySolana: async ({ signature }) => solAnswers.get(signature) ?? { status: "pending" },
    readSolanaBlockhash: async () => SOL_BLOCKHASH,
    creditFragments: async (credit) => {
      if (!relayUp) return new Response(null, { status: 503 });
      credits.push(credit);
      return Response.json({ id: "0x1" });
    },
    now: () => NOW,
  };
  const quote = async (body: Record<string, unknown>, realmsId = OWNER) => {
    const response = await handleExternalQuote(
      new Request("https://realms.test/api/shop/external/quote", { method: "POST", body: JSON.stringify(body) }),
      signedIn(realmsId),
      world,
    );
    return [response.status, await response.json()] as [number, Record<string, unknown>];
  };
  const pay = async (quoteId: string, txHash: string, realmsId = OWNER) => {
    const response = await handleExternalPay(
      new Request("https://realms.test/api/shop/external/pay", {
        method: "POST",
        body: JSON.stringify({ quoteId, txHash }),
      }),
      signedIn(realmsId),
      world,
    );
    return [response.status, await response.json()] as [number, Record<string, unknown>];
  };
  const status = async (txHash: string, realmsId = OWNER) => {
    const response = await handleExternalPayment(
      new Request(`https://realms.test/api/shop/external/pay/${encodeURIComponent(txHash)}`),
      signedIn(realmsId),
      world,
    );
    return [response.status, await response.json()] as [number, Record<string, unknown>];
  };
  return {
    world,
    credits,
    evmAnswers,
    solAnswers,
    quote,
    pay,
    status,
    relay: (up: boolean) => {
      relayUp = up;
    },
  };
};

it("refuses Base (8453) and Arbitrum (42161) on external EVM quote and disables unconfigured rails", async () => {
  const { quote } = await harness();
  expect(await quote({ chain: "0x1", game: 7, fragments: 500, rail: "evm", networkChainId: 8453 })).toEqual([
    400,
    { error: "unsupported_chain" },
  ]);
  expect(await quote({ chain: "0x1", game: 7, fragments: 500, rail: "evm", networkChainId: 42161 })).toEqual([
    400,
    { error: "unsupported_chain" },
  ]);
  const disabled = await harness({ evmEnabled: false, solanaEnabled: false });
  expect(await disabled.quote({ chain: "0x1", game: 7, fragments: 500, rail: "evm" })).toEqual([
    503,
    { error: "rail_disabled" },
  ]);
  expect(await disabled.quote({ chain: "0x1", game: 7, fragments: 500, rail: "solana" })).toEqual([
    503,
    { error: "rail_disabled" },
  ]);
});

it("quotes, settles, and idempotently credits EVM mainnet USDC with receipt evm:1:<txHash> and no 5% split", async () => {
  const { quote, pay, status, evmAnswers, credits, relay, world } = await harness();
  const [qStatus, qBody] = await quote({ chain: "0x1", game: 7, fragments: 1_000, rail: "evm", networkChainId: 1 });
  expect(qStatus).toBe(200);
  const offer = qBody.quote as { id: string; usdcUnits: string; treasury: string; token: string; chainId: number };
  expect(offer).toMatchObject({
    rail: "evm",
    chainId: 1,
    token: EVM_RAIL.usdc,
    treasury: EVM_RAIL.treasury,
    usdcUnits: "10000000",
    memo: evmQuoteCalldataSuffix(offer.id),
    recentBlockhash: null,
  });
  expect(await pay(offer.id, EVM_HASH)).toEqual([202, { state: "delivering" }]);
  evmAnswers.set(EVM_HASH, {
    status: "confirmed",
    payer: "0x1111111111111111111111111111111111111111",
    paidUnits: 10_000_000n,
    timestamp: NOW + 10,
  });
  relay(false);
  await settleExternalPayments(world);
  expect(await status(EVM_HASH)).toEqual([202, { state: "delivering", fragments: 1_000 }]);
  relay(true);
  await settleExternalPayments(world);
  await settleExternalPayments(world);
  expect(await status(EVM_HASH)).toEqual([200, { state: "delivered", fragments: 1_000 }]);
  expect(await pay(offer.id, EVM_HASH.toUpperCase().replace("0X", "0x"))).toEqual([
    200,
    { state: "delivered", fragments: 1_000 },
  ]);
  expect(credits).toEqual([{ chainId: "0x1", gameId: 7, realmsId: OWNER, id: `evm:1:${EVM_HASH}`, amount: 1_000 }]);
});

it("quotes, settles, and idempotently credits Solana mainnet USDC with memo quoteId and receipt sol:<sig>", async () => {
  const { quote, pay, status, solAnswers, credits } = await harness();
  const [qStatus, qBody] = await quote({ chain: "0x1", game: 7, fragments: 500, rail: "solana" });
  expect(qStatus).toBe(200);
  const offer = qBody.quote as { id: string; memo: string; usdcUnits: string; treasury: string; token: string };
  expect(offer).toMatchObject({
    rail: "solana",
    chainId: null,
    token: SOL_RAIL.usdc,
    treasury: SOL_RAIL.treasury,
    usdcUnits: "5000000",
    memo: offer.id,
    recentBlockhash: SOL_BLOCKHASH,
  });
  solAnswers.set(SOL_SIG, {
    status: "confirmed",
    payer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    paidUnits: 5_000_000n,
    timestamp: NOW + 5,
  });
  expect(await pay(offer.id, SOL_SIG)).toEqual([200, { state: "delivered", fragments: 500 }]);
  expect(await status(SOL_SIG)).toEqual([200, { state: "delivered", fragments: 500 }]);
  expect(await status(SOL_SIG, OTHER)).toEqual([404, { error: "unknown_payment" }]);
  expect(credits).toEqual([{ chainId: "0x1", gameId: 7, realmsId: OWNER, id: `sol:${SOL_SIG}`, amount: 500 }]);
});

it("lists unfulfilled external USDC payments in operator refunds and clears them once refunded", async () => {
  const { world, quote, pay, solAnswers } = await harness();
  const [, qBody] = await quote({ chain: "0x1", game: 7, fragments: 500, rail: "solana" });
  const offer = qBody.quote as { id: string; expiresAt: number };
  solAnswers.set(SOL_SIG, {
    status: "confirmed",
    payer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    paidUnits: 5_000_000n,
    timestamp: offer.expiresAt + 10,
  });
  expect(await pay(offer.id, SOL_SIG)).toEqual([
    409,
    { error: "refund_due", refund: { token: SOL_RAIL.usdc, wei: "5000000" } },
  ]);
  const listed = (await (await handleShopRefunds(world.db)).json()) as {
    refunds: { rail: string; transactionHash: string; reason: string; wei: string }[];
  };
  expect(listed.refunds).toEqual([
    expect.objectContaining({
      rail: "solana",
      transactionHash: SOL_SIG,
      reason: "unfulfilled_expired",
      wei: "5000000",
    }),
  ]);
  const refundSig = "4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
  const recorded = await handleShopRefunded(
    new Request("https://realms.test/api/operator/shop/refunds", {
      method: "POST",
      body: JSON.stringify({ transactionHash: SOL_SIG, refundTransaction: refundSig }),
    }),
    world.db,
  );
  expect(recorded.status).toBe(200);
  expect(((await (await handleShopRefunds(world.db)).json()) as { refunds: unknown[] }).refunds).toEqual([]);
});

it("excludes unfulfilled external receipts and abandoned Stripe intents from daily-cap settlement", async () => {
  const { world, quote, pay, evmAnswers, credits } = await harness();
  const [, underpaidQuote] = await quote({ chain: "0x1", game: 7, fragments: 5_000, rail: "evm" });
  const underpaidHash = `0x${"11".repeat(32)}`;
  evmAnswers.set(underpaidHash, {
    status: "confirmed",
    payer: "0x1111111111111111111111111111111111111111",
    paidUnits: 1_000_000n,
    timestamp: NOW + 10,
  });
  expect((await pay((underpaidQuote.quote as { id: string }).id, underpaidHash))[0]).toBe(409);

  const [, validQuote] = await quote({ chain: "0x1", game: 7, fragments: 6_000, rail: "evm" });
  await world.db
    .prepare(
      `INSERT INTO "stripe_payment_intents" ("intent_id", "owner", "chain_id", "game_id", "fragments", "cents", "status", "created_at")
       VALUES ('pi_abandoned', ?1, '0x1', 7, 6_000, 6_000, 'created', ?2)`,
    )
    .bind(OWNER, NOW + 30)
    .run();
  expect((await quote({ chain: "0x1", game: 7, fragments: 5_000, rail: "evm" }))[0]).toBe(429);
  evmAnswers.set(EVM_HASH, {
    status: "confirmed",
    payer: "0x1111111111111111111111111111111111111111",
    paidUnits: 60_000_000n,
    timestamp: NOW + 60,
  });
  expect(await pay((validQuote.quote as { id: string }).id, EVM_HASH)).toEqual([
    200,
    { state: "delivered", fragments: 6_000 },
  ]);
  expect(credits).toEqual([{ chainId: "0x1", gameId: 7, realmsId: OWNER, id: `evm:1:${EVM_HASH}`, amount: 6_000 }]);
});
