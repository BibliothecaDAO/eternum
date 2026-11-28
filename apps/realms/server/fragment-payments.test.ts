import { afterEach, expect, it } from "vitest";
import { splitLordsPayment } from "@realms-world/chain";

import type { IdentityAuth } from "./auth";
import type { FragmentCredit } from "./fragment-credit";
import { handleFragmentPrice } from "./fragment-price";
import {
  handleFragmentPay,
  handleFragmentPayment,
  handleShopRefunded,
  handleShopRefunds,
  settleFragmentPayments,
  type FragmentPaymentWorld,
  type SettledReceipt,
} from "./fragment-payments";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

const OWNER = "0xa1";
const OTHER = "0xb2";
const WALLET = "0xb0b";
const TOKEN = "0x55";
const TREASURY = "0x7a";
const VELORDS = "0x91b";
const TRANSFER = "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9";
const NOW = 1_000_000;
const WEI_PER_LORDS = 10n ** 18n;

interface Offer {
  id: string;
  lordsWei: string;
  treasuryWei: string;
  veLords: string;
  veLordsWei: string;
  expiresAt: number;
}

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
});

const migrated = async () => {
  const database = createTestD1();
  databases.push(database);
  const { db } = database;
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)));
  for (const realmsId of [OWNER, OTHER])
    await db
      .prepare(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId")
         VALUES (?1, ?1, ?1 || '@realms.test', 1, 1, 1, ?1)`,
      )
      .bind(realmsId)
      .run();
  return db;
};

const signedIn = (realmsId: string) =>
  ({ api: { getSession: async () => ({ user: { realmsId } }) } }) as unknown as IdentityAuth;

const paying = (wei: bigint, from = WALLET, status = "SUCCEEDED"): SettledReceipt["receipt"] => {
  const split = splitLordsPayment(wei);
  return {
    execution_status: status,
    finality_status: "ACCEPTED_ON_L2",
    events: [
      {
        from_address: TOKEN,
        keys: [TRANSFER, from, TREASURY],
        data: [`0x${split.treasuryWei.toString(16)}`, "0x0"],
      },
      {
        from_address: TOKEN,
        keys: [TRANSFER, from, VELORDS],
        data: [`0x${split.veLordsWei.toString(16)}`, "0x0"],
      },
    ],
  };
};

const ROUTER = "0x4270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f";

const swappedThenSent = (wei: bigint, sentBy: string): SettledReceipt["receipt"] => {
  const split = splitLordsPayment(wei);
  return {
    execution_status: "SUCCEEDED",
    finality_status: "ACCEPTED_ON_L2",
    events: [
      { from_address: TOKEN, keys: [TRANSFER], data: [ROUTER, WALLET, `0x${wei.toString(16)}`, "0x0"] },
      { from_address: TOKEN, keys: [TRANSFER], data: [sentBy, TREASURY, `0x${split.treasuryWei.toString(16)}`, "0x0"] },
      { from_address: TOKEN, keys: [TRANSFER], data: [sentBy, VELORDS, `0x${split.veLordsWei.toString(16)}`, "0x0"] },
    ],
  };
};

const shop = async () => {
  const db = await migrated();
  const receipts = new Map<string, SettledReceipt>();
  const credits: FragmentCredit[] = [];
  let relayUp = true;
  const world: FragmentPaymentWorld = {
    db,
    readReceipt: async (hash) => receipts.get(hash) ?? null,
    payersOf: async (realmsId) => (realmsId === OWNER ? [WALLET] : []),
    creditFragments: async (credit) => {
      if (!relayUp) return new Response(null, { status: 503 });
      credits.push(credit);
      return Response.json({ id: "0x1" });
    },
    now: () => NOW,
  };
  const quote = async (fragments: number, realmsId = OWNER, lordsPerDollar = 50) => {
    const response = await handleFragmentPrice(
      new Request(`https://realms.test/api/shop/fragments?chain=0x1&game=7&fragments=${fragments}`),
      signedIn(realmsId),
      {
        db,
        access: async () => true,
        readLordsQuote: async (cents) => (BigInt(cents) * BigInt(lordsPerDollar) * WEI_PER_LORDS) / 100n,
        payee: { token: TOKEN, treasury: TREASURY, veLords: VELORDS },
        now: () => NOW,
      },
    );
    return [response.status, await response.json()] as [number, { quote: Offer } & Record<string, unknown>];
  };
  const pay = async (quoteId: string, transactionHash: string, realmsId = OWNER) => {
    const response = await handleFragmentPay(
      new Request("https://realms.test/api/shop/fragments/pay", {
        method: "POST",
        body: JSON.stringify({ quoteId, transactionHash }),
      }),
      signedIn(realmsId),
      world,
    );
    return [response.status, await response.json()];
  };
  const status = async (transactionHash: string, realmsId = OWNER) => {
    const response = await handleFragmentPayment(
      new Request(`https://realms.test/api/shop/fragments/pay/${transactionHash}`),
      signedIn(realmsId),
      world,
    );
    return [response.status, await response.json()];
  };
  const settle = (receipt: SettledReceipt["receipt"], timestamp = NOW) => ({ receipt, timestamp });
  return {
    db,
    world,
    receipts,
    credits,
    quote,
    pay,
    status,
    settle,
    relay: (up: boolean) => {
      relayUp = up;
    },
  };
};

it("quotes Fragments as a 95/5 treasury and veLords LORDS split, held for ten minutes", async () => {
  const { quote } = await shop();
  const [status, body] = await quote(1_000);
  const split = splitLordsPayment(500n * WEI_PER_LORDS);
  expect(status).toBe(200);
  expect(body).toEqual({
    fragments: 1_000,
    cents: 1_000,
    quote: {
      id: expect.any(String),
      lordsWei: (500n * WEI_PER_LORDS).toString(),
      token: TOKEN,
      treasury: TREASURY,
      treasuryWei: split.treasuryWei.toString(),
      veLords: VELORDS,
      veLordsWei: split.veLordsWei.toString(),
      expiresAt: NOW + 600,
    },
  });
});

it("refuses as underpaid when a Starknet tx sends 100% to treasury without the 5% veLords transfer", async () => {
  const { quote, pay, receipts, credits, settle } = await shop();
  const [, { quote: offer }] = await quote(1_000);
  receipts.set(
    "0x555",
    settle({
      execution_status: "SUCCEEDED",
      finality_status: "ACCEPTED_ON_L2",
      events: [
        {
          from_address: TOKEN,
          keys: [TRANSFER, WALLET, TREASURY],
          data: [`0x${BigInt(offer.lordsWei).toString(16)}`, "0x0"],
        },
      ],
    }),
  );
  expect(await pay(offer.id, "0x555")).toEqual([
    409,
    { error: "refund_due", refund: { token: TOKEN, wei: offer.lordsWei } },
  ]);
  expect(credits).toEqual([]);
});

it("delivers a paid quote's Fragments to its game once, under the payment's own id", async () => {
  const { quote, pay, status, receipts, credits, settle } = await shop();
  const [, { quote: offer }] = await quote(1_000);
  receipts.set("0xabc", settle(paying(BigInt(offer.lordsWei))));
  expect(await pay(offer.id, "0xabc")).toEqual([200, { state: "delivered", fragments: 1_000 }]);
  expect(await pay(offer.id, "0xABC")).toEqual([200, { state: "delivered", fragments: 1_000 }]);
  expect(await status("0xabc")).toEqual([200, { state: "delivered", fragments: 1_000 }]);
  expect(credits).toEqual([{ chainId: "0x1", gameId: 7, realmsId: OWNER, id: "lords:0xabc", amount: 1_000 }]);
});

it("keeps delivering a payment the chain has not settled or the relay did not take, on the minute", async () => {
  const { quote, pay, receipts, credits, settle, relay, world } = await shop();
  const [, { quote: offer }] = await quote(500);
  expect(await pay(offer.id, "0x1")).toEqual([202, { state: "delivering" }]);
  receipts.set("0x1", settle(paying(BigInt(offer.lordsWei))));
  relay(false);
  await settleFragmentPayments(world);
  expect(await pay(offer.id, "0x1")).toEqual([202, { state: "delivering", fragments: 500 }]);
  relay(true);
  await settleFragmentPayments(world);
  await settleFragmentPayments(world);
  expect(await pay(offer.id, "0x1")).toEqual([200, { state: "delivered", fragments: 500 }]);
  expect(credits.map(({ id }) => id)).toEqual(["lords:0x1"]);
});

it("delivers a swap's LORDS the wallet then sent to the treasury, and refuses LORDS the swap's router sent there itself", async () => {
  const { quote, pay, receipts, credits, settle } = await shop();
  const [, { quote: offer }] = await quote(1_000);
  receipts.set("0x5a", settle(swappedThenSent(BigInt(offer.lordsWei), ROUTER)));
  expect(await pay(offer.id, "0x5a")).toEqual([409, { error: "payment_refused" }]);
  expect(credits).toEqual([]);
  receipts.set("0x5b", settle(swappedThenSent(BigInt(offer.lordsWei), WALLET)));
  expect(await pay(offer.id, "0x5b")).toEqual([200, { state: "delivered", fragments: 1_000 }]);
  expect(credits.map(({ id, amount }) => [id, amount])).toEqual([["lords:0x5b", 1_000]]);
});

it("refuses a payment that reverted or that no wallet of the account sent, and takes another transaction for the quote", async () => {
  const { quote, pay, receipts, credits, settle } = await shop();
  const [, { quote: offer }] = await quote(100);
  const wei = BigInt(offer.lordsWei);
  receipts.set("0x2", settle(paying(wei, "0xe5e")));
  receipts.set("0x3", settle(paying(wei, WALLET, "REVERTED")));
  receipts.set("0x4", settle(paying(wei)));
  expect(await pay(offer.id, "0x2")).toEqual([409, { error: "payment_refused" }]);
  expect(await pay(offer.id, "0x3")).toEqual([409, { error: "payment_refused" }]);
  expect(await pay(offer.id, "0x4")).toEqual([200, { state: "delivered", fragments: 100 }]);
  expect(await pay(offer.id, "0x5")).toEqual([409, { error: "quote_paid" }]);
  expect(credits).toHaveLength(1);
});

it("owes a refund for less than the quote or a payment after it expired, and the operator's list names it", async () => {
  const { db, quote, pay, receipts, credits, settle } = await shop();
  const [, { quote: short }] = await quote(100);
  const [, { quote: late }] = await quote(100);
  receipts.set("0x6", settle(paying(BigInt(short.lordsWei) - 1n)));
  receipts.set("0x7", settle(paying(BigInt(late.lordsWei)), late.expiresAt + 1));
  expect(await pay(short.id, "0x6")).toEqual([
    409,
    { error: "refund_due", refund: { token: TOKEN, wei: (BigInt(short.lordsWei) - 1n).toString() } },
  ]);
  expect(await pay(late.id, "0x7")).toEqual([
    409,
    { error: "refund_due", refund: { token: TOKEN, wei: late.lordsWei } },
  ]);
  expect(credits).toEqual([]);
  const refunds = (await (await handleShopRefunds(db)).json()) as { refunds: Record<string, unknown>[] };
  expect(refunds.refunds.map(({ transactionHash, reason, payer }) => [transactionHash, reason, payer])).toEqual([
    ["0x6", "unfulfilled_underpaid", WALLET],
    ["0x7", "unfulfilled_expired", WALLET],
  ]);
});

it("answers an expired quote with nothing paid, and gives up on a payment never seen an hour past its expiry", async () => {
  const { quote, pay, world } = await shop();
  const [, { quote: offer }] = await quote(100);
  const [, { quote: other }] = await quote(100);
  expect(await pay(other.id, "0x9")).toEqual([202, { state: "delivering" }]);
  world.now = () => NOW + 601;
  expect(await pay(offer.id, "0x8")).toEqual([410, { error: "quote_expired" }]);
  world.now = () => NOW + 600 + 3_601;
  await settleFragmentPayments(world);
  expect(await pay(other.id, "0x9")).toEqual([410, { error: "quote_expired" }]);
});

it("counts a refunded payment against no daily limit, and lists a payment whose account was deleted for refund", async () => {
  const { db, quote, pay, receipts, settle, world } = await shop();
  const [, { quote: short }] = await quote(9_900);
  receipts.set("0xc", settle(paying(BigInt(short.lordsWei) - 1n)));
  await pay(short.id, "0xc");
  expect((await quote(10_000))[0]).toBe(200);
  const [, { quote: offer }] = await quote(100);
  expect(await pay(offer.id, "0xd")).toEqual([202, { state: "delivering" }]);
  await db.prepare(`UPDATE "fragment_quotes" SET "owner" = NULL WHERE "id" = ?`).bind(offer.id).run();
  receipts.set("0xd", settle(paying(BigInt(offer.lordsWei))));
  await settleFragmentPayments(world);
  const refunds = (await (await handleShopRefunds(db)).json()) as { refunds: Record<string, unknown>[] };
  expect(refunds.refunds.map(({ transactionHash, reason }) => [transactionHash, reason])).toEqual([
    ["0xc", "unfulfilled_underpaid"],
    ["0xd", "unfulfilled_deleted"],
  ]);
});

it("lets the payer claim a transfer someone else claimed first without paying it", async () => {
  const { quote, pay, receipts, settle } = await shop();
  const [, { quote: theirs }] = await quote(100, OTHER);
  const [, { quote: mine }] = await quote(100);
  receipts.set("0x10", settle(paying(BigInt(mine.lordsWei))));
  expect(await pay(theirs.id, "0x10", OTHER)).toEqual([409, { error: "payment_refused" }]);
  expect(await pay(mine.id, "0x10")).toEqual([200, { state: "delivered", fragments: 100 }]);
});

it("delivers a transfer whose block opened before the quote was made", async () => {
  const { quote, pay, receipts, settle } = await shop();
  const [, { quote: offer }] = await quote(100);
  receipts.set("0xe", settle(paying(BigInt(offer.lordsWei)), NOW - 2));
  expect(await pay(offer.id, "0xe")).toEqual([200, { state: "delivered", fragments: 100 }]);
});

it("takes a refund off the operator's list once its transfer is recorded, the same one twice and no other", async () => {
  const { db, quote, pay, receipts, settle } = await shop();
  const [, { quote: short }] = await quote(100);
  const [, { quote: paid }] = await quote(100);
  receipts.set("0x21", settle(paying(BigInt(short.lordsWei) - 1n)));
  receipts.set("0x22", settle(paying(BigInt(paid.lordsWei))));
  await pay(short.id, "0x21");
  await pay(paid.id, "0x22");
  const record = async (body: unknown) => {
    const response = await handleShopRefunded(
      new Request("https://realms.test/api/operator/shop/refunds", { method: "POST", body: JSON.stringify(body) }),
      db,
    );
    return [response.status, await response.json()];
  };
  const listed = async () =>
    ((await (await handleShopRefunds(db)).json()) as { refunds: { transactionHash: string }[] }).refunds.map(
      ({ transactionHash }) => transactionHash,
    );
  expect(await listed()).toEqual(["0x21"]);
  expect(await record({ transactionHash: "0x21" })).toEqual([400, { error: "invalid_refund" }]);
  expect(await record({ transactionHash: "0x22", refundTransaction: "0xf0" })).toEqual([
    404,
    { error: "unknown_refund" },
  ]);
  expect(await record({ transactionHash: "0x99", refundTransaction: "0xf0" })).toEqual([
    404,
    { error: "unknown_refund" },
  ]);
  expect(await listed()).toEqual(["0x21"]);
  const recorded = [200, { refunded: "0x21", refundTransaction: "0xf0" }];
  expect(await record({ transactionHash: "0x21", refundTransaction: "0xF0" })).toEqual(recorded);
  expect(await record({ transactionHash: "0x21", refundTransaction: "0xf0" })).toEqual(recorded);
  expect(await record({ transactionHash: "0x21", refundTransaction: "0xf1" })).toEqual([
    409,
    { error: "already_refunded", refundTransaction: "0xf0" },
  ]);
  expect(await listed()).toEqual([]);
});

it("counts a quote against the day it was made, however late its payment is reported", async () => {
  const { quote, pay, receipts, settle, world } = await shop();
  const [, { quote: first }] = await quote(10_000);
  const [, { quote: second }] = await quote(10_000);
  receipts.set("0xf1", settle(paying(BigInt(first.lordsWei)), NOW + 10));
  receipts.set("0xf2", settle(paying(BigInt(second.lordsWei)), NOW + 10));
  world.now = () => NOW + 40_000;
  expect(await pay(first.id, "0xf1")).toEqual([200, { state: "delivered", fragments: 10_000 }]);
  expect(await pay(second.id, "0xf2")).toEqual([
    409,
    { error: "refund_due", refund: { token: TOKEN, wei: second.lordsWei } },
  ]);
});

it("sells at most 10,000 Fragments an account a day", async () => {
  const { quote, pay, receipts, settle } = await shop();
  const [, { quote: big }] = await quote(9_900);
  receipts.set("0xa", settle(paying(BigInt(big.lordsWei))));
  await pay(big.id, "0xa");
  expect(await quote(101)).toEqual([429, { error: "daily_cap", remaining: 100 }]);
  expect((await quote(100))[0]).toBe(200);
  expect((await quote(10_000, OTHER))[0]).toBe(200);
});

it("keeps a quote and its payment to the account that asked, and a transaction to one quote", async () => {
  const { quote, pay, status, receipts, settle } = await shop();
  const [, { quote: mine }] = await quote(100);
  const [, { quote: second }] = await quote(100);
  receipts.set("0xb", settle(paying(BigInt(mine.lordsWei))));
  expect(await pay(mine.id, "0xb", OTHER)).toEqual([404, { error: "unknown_quote" }]);
  await pay(mine.id, "0xb");
  expect(await status("0xb", OTHER)).toEqual([404, { error: "unknown_payment" }]);
  expect(await pay(second.id, "0xb")).toEqual([409, { error: "transaction_used" }]);
});
