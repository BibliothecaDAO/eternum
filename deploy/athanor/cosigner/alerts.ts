import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { rpcAt } from "../../../packages/value-ledger/src/rpc";
import { privateFile, readConfig } from "./config";
import { COSIGNER_WALLETS, WALLET_CHANGE_SECONDS, readWalletRecords, type WalletRecord } from "./wallets";

/**
 * Tells the owner's private Discord channel, from the box and off Cloudflare, when a payout safeguard trips: a wallet
 * change held for 24 h, a paused ledger, or a co-signer that stopped answering. A systemd timer runs `check` every
 * minute; it posts once per change and once when it clears, so a rerun or a crash never repeats a message.
 */
const ALERT_STATE = "/var/lib/payout-cosigner/alerts.json";
/** The co-signer restarts within seconds; only a silence this long is an outage. */
const COSIGNER_DOWN_SECONDS = 3 * 60;
/** Discord refuses a message over 2,000 characters. */
const MESSAGE_LIMIT = 1_900;

/** One minute's reading of the box. A source that could not be read is null and changes nothing. */
interface PayoutSnapshot {
  cosignerAnswers: boolean;
  ledgerPaused: boolean | null;
  wallets: WalletRecord[] | null;
}
interface AlertState {
  held: Record<string, { wallet: string; since: number }>;
  ledgerPaused: boolean;
  cosignerSilentSince: number | null;
  cosignerDownAnnounced: boolean;
}
const QUIET: AlertState = { held: {}, ledgerPaused: false, cosignerSilentSince: null, cosignerDownAnnounced: false };

function nextAlerts(previous: AlertState, snapshot: PayoutSnapshot, now: number) {
  const wallets = walletChanges(previous.held, snapshot.wallets);
  const ledger = ledgerPause(previous.ledgerPaused, snapshot.ledgerPaused);
  const cosigner = cosignerSilence(previous, snapshot.cosignerAnswers, now);
  return {
    state: { held: wallets.held, ledgerPaused: ledger.paused, ...cosigner.state } satisfies AlertState,
    lines: [...wallets.lines, ...ledger.lines, ...cosigner.lines],
  };
}

/** Reads the box, posts what changed, then records it: a failed post records nothing, so the next minute retries. */
export async function checkPayoutAlerts(
  read: (watchedRealmsIds: string[]) => Promise<PayoutSnapshot>,
  statePath: string,
  post: (content: string) => Promise<void>,
  now: number,
) {
  const previous = readState(statePath);
  const { state, lines } = nextAlerts(previous, await read(Object.keys(previous.held)), now);
  if (lines.length) await post(message(lines));
  writeState(statePath, state);
  return lines;
}

export async function postToDiscord(webhook: string, content: string, network: typeof fetch = fetch) {
  let response: Response;
  try {
    response = await network(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // The webhook URL is the channel's credential: no error carries it or the network library's text about it.
    throw new Error("discord_webhook_unreachable");
  }
  if (!response.ok) throw new Error(`discord_webhook_refused_${response.status}`);
}

/** The box as the co-signer sees it: its own loopback health, the ledger it signs for, and its wallet history. */
function readBox(config: { port: number; l2RpcUrl: string; ledgerAddress: string }, walletsPath: string) {
  return async (watchedRealmsIds: string[]): Promise<PayoutSnapshot> => {
    const [cosignerAnswers, ledgerPaused] = await Promise.all([
      cosignerHealthy(config.port),
      readLedgerPaused(config.l2RpcUrl, config.ledgerAddress),
    ]);
    return { cosignerAnswers, ledgerPaused, wallets: readWalletsOrNull(walletsPath, watchedRealmsIds) };
  };
}

function walletChanges(previous: AlertState["held"], records: WalletRecord[] | null) {
  if (!records) return { held: previous, lines: [] };
  const held: AlertState["held"] = {};
  const lines: string[] = [];
  for (const record of records) {
    const was = previous[record.realmsId];
    if (record.pending === null || record.since === null) {
      if (was) lines.push(holdEnded(record, was.wallet));
      continue;
    }
    held[record.realmsId] = { wallet: record.pending, since: record.since };
    if (!was || was.wallet !== record.pending || was.since !== record.since) lines.push(holdBegan(record));
  }
  // A watched ID the reader did not return has no newer record: it stays held rather than reading as cleared.
  for (const [realmsId, was] of Object.entries(previous))
    if (!records.some((record) => record.realmsId === realmsId)) held[realmsId] = was;
  return { held, lines };
}
const holdBegan = (record: WalletRecord) =>
  `Wallet change held: ${who(record)} asks to be paid at ${record.pending} instead of ${record.wallet}. ` +
  `Payouts to it wait until ${utc(record.since! + WALLET_CHANGE_SECONDS)}. If the player didn't ask for this, pause the ledger before then.`;
const holdEnded = (record: WalletRecord, heldWallet: string) =>
  record.wallet === heldWallet
    ? `Wallet change accepted after 24 h: ${who(record)} is now paid at ${record.wallet}.`
    : `Wallet change dropped: ${who(record)} is paid at its known wallet ${record.wallet} again.`;
const who = (record: WalletRecord) =>
  `Realms ID ${record.realmsId}${record.accounts.length ? ` (account ${record.accounts.join(", ")})` : ""}`;

function ledgerPause(previous: boolean, paused: boolean | null) {
  if (paused === null || paused === previous) return { paused: previous, lines: [] };
  return {
    paused,
    lines: [
      paused
        ? "The ledger is paused. No payout goes out until the cold admin unpauses it."
        : "The ledger is unpaused. Payouts resume.",
    ],
  };
}

function cosignerSilence(previous: AlertState, answers: boolean, now: number) {
  if (answers)
    return {
      state: { cosignerSilentSince: null, cosignerDownAnnounced: false },
      lines: previous.cosignerDownAnnounced
        ? [`The co-signer answers again; it was silent from ${utc(previous.cosignerSilentSince!)}.`]
        : [],
    };
  const since = previous.cosignerSilentSince ?? now;
  const announce = !previous.cosignerDownAnnounced && now - since >= COSIGNER_DOWN_SECONDS;
  return {
    state: { cosignerSilentSince: since, cosignerDownAnnounced: previous.cosignerDownAnnounced || announce },
    lines: announce
      ? [`The co-signer has not answered on the box since ${utc(since)}. Withdrawals and prizes wait until it is back.`]
      : [],
  };
}

function message(lines: string[]) {
  const content = `Production payouts:\n${lines.map((line) => `- ${line}`).join("\n")}`;
  if (content.length <= MESSAGE_LIMIT) return content;
  return `${content.slice(0, MESSAGE_LIMIT)}\n… more on the box: curl -s 127.0.0.1:<port>/health and journalctl -u payout-cosigner`;
}
const utc = (seconds: number) => `${new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;

async function cosignerHealthy(port: number) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok && ((await response.json()) as { service?: string }).service === "payout-cosigner";
  } catch {
    return false;
  }
}
async function readLedgerPaused(rpcUrl: string, ledgerAddress: string) {
  try {
    const row = await rpcAt(rpcUrl).callContract({
      contractAddress: ledgerAddress,
      entrypoint: "is_paused",
      calldata: [],
    });
    return row.length === 1 ? BigInt(row[0]!) !== 0n : null;
  } catch {
    // The RPC URL holds its provider key; an unreadable minute stays silent and the next one reads again.
    return null;
  }
}
function readWalletsOrNull(path: string, realmsIds: string[]) {
  try {
    return readWalletRecords(path, realmsIds);
  } catch {
    return null;
  }
}

function readState(path: string): AlertState {
  if (!existsSync(path)) return QUIET;
  return { ...QUIET, ...(JSON.parse(privateFile(path)) as Partial<AlertState>) };
}
function writeState(path: string, state: AlertState) {
  const temporary = `${path}.tmp`;
  rmSync(temporary, { force: true });
  writeFileSync(temporary, JSON.stringify(state) + "\n", { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}

if (import.meta.main) {
  const [command, configPath, webhookPath] = process.argv.slice(2);
  if ((command !== "check" && command !== "test") || !configPath || !webhookPath)
    throw new Error("usage: alerts.ts check|test CONFIG_FILE WEBHOOK_FILE");
  const config = readConfig(configPath);
  const webhook = privateFile(webhookPath);
  const post = (content: string) => postToDiscord(webhook, content);
  if (command === "test") {
    await post(
      `Payout alerts are wired for ledger ${config.ledgerAddress}. This channel hears when a wallet change is held, ` +
        "when the ledger is paused, and when the co-signer stops answering, then again when each clears.",
    );
    console.log(JSON.stringify({ service: "payout-alerts", test: "sent" }));
  } else {
    const lines = await checkPayoutAlerts(
      readBox(config, COSIGNER_WALLETS),
      ALERT_STATE,
      post,
      Math.floor(Date.now() / 1000),
    );
    if (lines.length) console.log(JSON.stringify({ service: "payout-alerts", posted: lines.length }));
  }
}
