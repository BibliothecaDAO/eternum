import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { channelOf, checkPayoutAlerts, postToDiscord } from "./alerts";
import { openCosignerWallets, readWalletRecords } from "./wallets";

let directory: string, walletsPath: string, statePath: string, now: number;
let box: { cosignerAnswers: boolean; ledgerPaused: boolean | null };
let wallets: ReturnType<typeof openCosignerWallets>;
const posts: string[] = [];
const post = async (content: string) => void posts.push(content);
const read = async (watched: string[]) => ({ ...box, wallets: readWalletRecords(walletsPath, watched) });
const channel = channelOf("https://discord.com/api/webhooks/1/fixture", "0x1234");
const check = (deliver: (content: string) => Promise<void> = post, to = channel) =>
  checkPayoutAlerts(read, statePath, deliver, now, to);
const header = "Production payouts:\n- ";
const wired =
  "Payout alerts are wired for ledger 0x1234. This channel hears when a wallet change is held, when the ledger is " +
  "paused, and when the co-signer stops answering, then again when each clears.";
const paused = "The ledger is paused. No payout goes out until the ledger admin unpauses it.";
const failing = async () => {
  throw new Error("discord_webhook_unreachable");
};
const holdFor = (realm: number) => {
  wallets.assertWallet(`0x${(0xa00 + realm).toString(16)}`, `0x${realm.toString(16)}`, "0x100");
  expect(() => wallets.assertWallet(`0x${(0xa00 + realm).toString(16)}`, `0x${realm.toString(16)}`, "0x200")).toThrow(
    "cosigner_wallet_change_waiting",
  );
};

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "payout-alerts-"));
  walletsPath = join(directory, "wallets.sqlite");
  statePath = join(directory, "alerts.json");
  now = 1_000;
  box = { cosignerAnswers: true, ledgerPaused: false };
  posts.length = 0;
  wallets = openCosignerWallets(
    walletsPath,
    () => now,
    () => {},
  );
  await check();
  posts.length = 0;
});
afterEach(() => {
  wallets.close();
  rmSync(directory, { recursive: true });
});

test("a channel hears it is wired once, and only Discord's acceptance records it", async () => {
  const fresh = channelOf("https://discord.com/api/webhooks/2/other", "0x1234");
  await expect(check(failing, fresh)).rejects.toThrow("discord_webhook_unreachable");
  await check(post, fresh);
  await check(post, fresh);
  expect(posts).toEqual([`${header}${wired}`]);
  expect(statSync(statePath).mode & 0o777).toBe(0o600);
});

test("a held wallet change posts once with who and when it releases, then once when it is accepted", async () => {
  holdFor(1);
  await check();
  await check();
  expect(posts).toEqual([
    `${header}Wallet change held: Realms ID 0x1 (account 0xa01) asks to be paid at 0x200 instead of 0x100. ` +
      "Payouts to it wait until 1970-01-02 00:16 UTC. If the player didn't ask for this, pause the ledger before then.",
  ]);
  now += 24 * 60 * 60;
  wallets.assertWallet("0xa01", "0x1", "0x200");
  await check();
  await check();
  expect(posts.slice(1)).toEqual([
    `${header}Wallet change accepted after 24 h: Realms ID 0x1 (account 0xa01) is now paid at 0x200.`,
  ]);
});

test("a hold cancelled by the known wallet posts that it was dropped", async () => {
  holdFor(1);
  await check();
  wallets.assertWallet("0xa01", "0x1", "0x100");
  await check();
  expect(posts.slice(1)).toEqual([
    `${header}Wallet change dropped: Realms ID 0x1 (account 0xa01) is paid at its known wallet 0x100 again.`,
  ]);
});

test("a Realms ID with many accounts names three and counts the rest", async () => {
  for (const account of ["0xb1", "0xb2", "0xb3", "0xb4"]) wallets.assertWallet(account, "0x1", "0x100");
  holdFor(1);
  await check();
  expect(posts[0]).toContain("Realms ID 0x1 (account 0xa01, 0xb1, 0xb2 and 2 more) asks");
});

test("a paused ledger posts once and its unpause once; an unreadable minute changes nothing", async () => {
  box.ledgerPaused = true;
  await check();
  await check();
  box.ledgerPaused = null;
  await check();
  box.ledgerPaused = true;
  await check();
  box.ledgerPaused = false;
  await check();
  expect(posts).toEqual([`${header}${paused}`, `${header}The ledger is unpaused. Payouts resume.`]);
});

test("the co-signer is announced down after three silent minutes, once, and back once", async () => {
  box.cosignerAnswers = false;
  await check();
  now += 60;
  box.cosignerAnswers = true;
  await check();
  expect(posts).toEqual([]);

  box.cosignerAnswers = false;
  const silentFrom = now;
  for (const minute of [0, 1, 2, 3, 4, 5]) {
    now = silentFrom + minute * 60;
    await check();
  }
  now += 60;
  box.cosignerAnswers = true;
  await check();
  await check();
  expect(posts).toEqual([
    `${header}The co-signer has not answered on the box since 1970-01-01 00:17 UTC. Withdrawals and prizes wait until it is back.`,
    `${header}The co-signer answers again; it was silent from 1970-01-01 00:17 UTC.`,
  ]);
});

test("a busy minute is sent whole, in messages Discord accepts, and each alert once", async () => {
  for (let realm = 0x10; realm < 0x1e; realm++) holdFor(realm);
  box.ledgerPaused = true;
  await check();
  await check();
  expect(posts.length).toBeGreaterThan(1);
  for (const content of posts) expect(content.length).toBeLessThanOrEqual(2_000);
  const delivered = posts.flatMap((content) => content.split("\n- ").slice(1));
  expect(delivered).toHaveLength(15);
  for (let realm = 0x10; realm < 0x1e; realm++)
    expect(delivered.filter((alert) => alert.includes(`Realms ID 0x${realm.toString(16)} `))).toHaveLength(1);
  expect(delivered.at(-1)).toBe(paused);
});

test("a delivery that fails partway sends the rest next minute and nothing twice", async () => {
  for (let realm = 0x10; realm < 0x1e; realm++) holdFor(realm);
  box.ledgerPaused = true;
  let calls = 0;
  const failsSecond = async (content: string) => {
    if (++calls === 2) throw new Error("discord_webhook_refused_429");
    posts.push(content);
  };
  await expect(check(failsSecond)).rejects.toThrow("discord_webhook_refused_429");
  expect(posts).toHaveLength(1);
  await check();
  await check();
  const delivered = posts.flatMap((content) => content.split("\n- ").slice(1));
  expect(delivered).toHaveLength(15);
  expect(new Set(delivered).size).toBe(15);
  expect(delivered.at(-1)).toBe(paused);
});

test("an accepted post whose answer is lost is sent again: at least once, never dropped", async () => {
  box.ledgerPaused = true;
  const answerLost = async (content: string) => {
    posts.push(content);
    throw new Error("discord_webhook_unreachable");
  };
  await expect(check(answerLost)).rejects.toThrow("discord_webhook_unreachable");
  await check();
  await check();
  expect(posts).toEqual([`${header}${paused}`, `${header}${paused}`]);
});

test("news that happens while Discord is down for a whole hold is all sent, in order, once it is back", async () => {
  holdFor(1);
  await expect(check(failing)).rejects.toThrow();
  box.cosignerAnswers = false;
  for (const minute of [1, 2, 3, 4]) {
    now = 1_000 + minute * 60;
    await expect(check(failing)).rejects.toThrow();
  }
  box.cosignerAnswers = true;
  now = 1_000 + 24 * 60 * 60;
  wallets.assertWallet("0xa01", "0x1", "0x200");
  await check();
  expect(posts).toHaveLength(1);
  expect(
    posts[0]!
      .split("\n- ")
      .slice(1)
      .map((alert) => alert.split(":")[0]),
  ).toEqual([
    "Wallet change held",
    "The co-signer has not answered on the box since 1970-01-01 00",
    "Wallet change accepted after 24 h",
    "The co-signer answers again; it was silent from 1970-01-01 00",
  ]);
});

const webhook = "https://discord.com/api/webhooks/1/secret-token";
test("Discord receives the message without mentions and refuses redirects", async () => {
  const requests: [string, RequestInit][] = [];
  const network = (async (url: string, init: RequestInit) => {
    requests.push([url, init]);
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  await postToDiscord(webhook, "hello", network);
  expect(requests).toHaveLength(1);
  expect(requests[0]![0]).toBe(webhook);
  expect(requests[0]![1].redirect).toBe("manual");
  expect(JSON.parse(String(requests[0]![1].body))).toEqual({ content: "hello", allowed_mentions: { parse: [] } });
  const moved = (async () => new Response(null, { status: 301 })) as unknown as typeof fetch;
  await expect(postToDiscord(webhook, "hello", moved)).rejects.toThrow("discord_webhook_refused_301");
});

test("a failed post never repeats the webhook address in its error", async () => {
  const unreachable = (async (url: string) => {
    throw new Error(`Unable to connect to ${url}`);
  }) as unknown as typeof fetch;
  const error = await postToDiscord(webhook, "hello", unreachable).catch((caught: Error) => caught);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe("discord_webhook_unreachable");
  expect(String((error as Error).stack)).not.toContain("secret-token");
});
