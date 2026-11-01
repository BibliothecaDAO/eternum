import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkPayoutAlerts, postToDiscord } from "./alerts";
import { openCosignerWallets, readWalletRecords } from "./wallets";

let directory: string, walletsPath: string, statePath: string, now: number;
let box: { cosignerAnswers: boolean; ledgerPaused: boolean | null };
let wallets: ReturnType<typeof openCosignerWallets>;
const posts: string[] = [];
const post = async (content: string) => void posts.push(content);
const read = async (watched: string[]) => ({ ...box, wallets: readWalletRecords(walletsPath, watched) });
const check = () => checkPayoutAlerts(read, statePath, post, now);
const header = "Production payouts:\n- ";

beforeEach(() => {
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
  wallets.assertWallet("0xa", "0x1", "0x100");
});
afterEach(() => {
  wallets.close();
  rmSync(directory, { recursive: true });
});

test("a held wallet change posts once with who and when it releases, then once when it is accepted", async () => {
  await check();
  expect(posts).toEqual([]);
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).toThrow("cosigner_wallet_change_waiting");
  await check();
  await check();
  expect(posts).toEqual([
    `${header}Wallet change held: Realms ID 0x1 (account 0xa) asks to be paid at 0x200 instead of 0x100. ` +
      "Payouts to it wait until 1970-01-02 00:16 UTC. If the player didn't ask for this, pause the ledger before then.",
  ]);
  expect(statSync(statePath).mode & 0o777).toBe(0o600);
  now += 24 * 60 * 60;
  wallets.assertWallet("0xa", "0x1", "0x200");
  await check();
  await check();
  expect(posts.slice(1)).toEqual([
    `${header}Wallet change accepted after 24 h: Realms ID 0x1 (account 0xa) is now paid at 0x200.`,
  ]);
});

test("a hold cancelled by the known wallet posts that it was dropped", async () => {
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).toThrow("cosigner_wallet_change_waiting");
  await check();
  wallets.assertWallet("0xa", "0x1", "0x100");
  await check();
  expect(posts.slice(1)).toEqual([
    `${header}Wallet change dropped: Realms ID 0x1 (account 0xa) is paid at its known wallet 0x100 again.`,
  ]);
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
  expect(posts).toEqual([
    `${header}The ledger is paused. No payout goes out until the ledger admin unpauses it.`,
    `${header}The ledger is unpaused. Payouts resume.`,
  ]);
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

test("a failed post records nothing, so the next minute posts the same news", async () => {
  box.ledgerPaused = true;
  const failing = async () => {
    throw new Error("discord_webhook_refused_429");
  };
  await expect(checkPayoutAlerts(read, statePath, failing, now)).rejects.toThrow("discord_webhook_refused_429");
  await check();
  expect(posts).toEqual([`${header}The ledger is paused. No payout goes out until the ledger admin unpauses it.`]);
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
