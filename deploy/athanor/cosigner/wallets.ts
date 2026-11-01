import { Database } from "bun:sqlite";
import { closeSync, existsSync, openSync, statSync } from "node:fs";
import type { CosignerWallets } from "../../../apps/value-relay/src/cosigner";

/** The co-signer's wallet history on the box, owned by its systemd state directory. */
export const COSIGNER_WALLETS = "/var/lib/payout-cosigner/wallets.sqlite";
export const WALLET_CHANGE_SECONDS = 24 * 60 * 60;
const SCHEMA = `CREATE TABLE IF NOT EXISTS accounts (account TEXT PRIMARY KEY, realms_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wallets (realms_id TEXT PRIMARY KEY, wallet TEXT NOT NULL, pending TEXT, since INTEGER)`;
interface Wallet {
  wallet: string;
  pending: string | null;
  since: number | null;
}
export interface WalletObservation {
  event: "cosigner_wallet_change_waiting" | "cosigner_wallet_change_accepted" | "cosigner_account_identity_changed";
  account: string;
  realmsId: string;
  wallet: string;
  notBefore?: number;
}

/** Box-owned durable evidence survives restarts; no request can clear or replace this database. */
export function openCosignerWallets(
  path: string,
  now = () => Math.floor(Date.now() / 1000),
  warn: (observation: WalletObservation) => void = (observation) => console.warn(JSON.stringify(observation)),
): CosignerWallets & { close(): void } {
  closeSync(openSync(path, "a", 0o600));
  if ((statSync(path).mode & 0o777) !== 0o600) throw new Error("cosigner_wallet_file_requires_0600");
  const db = new Database(path, { strict: true });
  db.exec(SCHEMA);
  const observe = db.transaction((account: string, realmsId: string, wallet: string): WalletObservation | null => {
    const known = db
      .query<{ realms_id: string }, [string]>("SELECT realms_id FROM accounts WHERE account=?")
      .get(account);
    if (known && known.realms_id !== realmsId)
      return { event: "cosigner_account_identity_changed", account, realmsId, wallet };
    db.query("INSERT OR IGNORE INTO accounts VALUES (?, ?)").run(account, realmsId);
    const previous = db
      .query<Wallet, [string]>("SELECT wallet, pending, since FROM wallets WHERE realms_id=?")
      .get(realmsId);
    if (!previous) {
      db.query("INSERT INTO wallets VALUES (?, ?, NULL, NULL)").run(realmsId, wallet);
      return null;
    }
    if (previous.wallet === wallet) {
      db.query("UPDATE wallets SET pending=NULL, since=NULL WHERE realms_id=?").run(realmsId);
      return null;
    }
    const time = now();
    const since = previous.pending === wallet && previous.since !== null ? previous.since : time;
    if (time < since + WALLET_CHANGE_SECONDS) {
      db.query("UPDATE wallets SET pending=?, since=? WHERE realms_id=?").run(wallet, since, realmsId);
      return {
        event: "cosigner_wallet_change_waiting",
        account,
        realmsId,
        wallet,
        notBefore: since + WALLET_CHANGE_SECONDS,
      };
    }
    db.query("UPDATE wallets SET wallet=?, pending=NULL, since=NULL WHERE realms_id=?").run(wallet, realmsId);
    return { event: "cosigner_wallet_change_accepted", account, realmsId, wallet };
  });
  return {
    assertWallet(account, realmsId, wallet) {
      const observation = observe(felt(account), felt(realmsId), felt(wallet));
      if (!observation) return;
      warn(observation);
      // Persist the observation before refusing so a retry cannot restart or bypass its waiting period.
      if (observation.event !== "cosigner_wallet_change_accepted") throw new Error(observation.event);
    },
    pendingChanges: () =>
      db
        .query<
          ReturnType<CosignerWallets["pendingChanges"]>,
          []
        >("SELECT COUNT(*) AS count, MIN(since) AS oldestSince FROM wallets WHERE pending IS NOT NULL")
        .get()!,
    close: () => db.close(),
  };
}
/** One Realms ID's wallet record: its known wallet, and the candidate held for 24 h since `since`, if any. */
export interface WalletRecord {
  realmsId: string;
  wallet: string;
  pending: string | null;
  since: number | null;
  accounts: string[];
}

/**
 * Reads, without writing, every held wallet change and the records of the Realms IDs asked for, so a reader beside the
 * running co-signer can tell a hold that began from one that ended. A database the co-signer never created holds none.
 */
export function readWalletRecords(path: string, realmsIds: string[] = []): WalletRecord[] {
  if (!existsSync(path)) return [];
  const db = new Database(path, { readonly: true, strict: true });
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    const rows = db
      .query<Omit<WalletRecord, "accounts">, [string]>(
        `SELECT realms_id AS realmsId, wallet, pending, since FROM wallets
         WHERE pending IS NOT NULL OR realms_id IN (SELECT value FROM json_each(?)) ORDER BY realms_id`,
      )
      .all(JSON.stringify(realmsIds));
    const accounts = db.query<{ account: string }, [string]>(
      "SELECT account FROM accounts WHERE realms_id=? ORDER BY account",
    );
    return rows.map((row) => ({ ...row, accounts: accounts.all(row.realmsId).map(({ account }) => account) }));
  } finally {
    db.close();
  }
}
function felt(value: string) {
  const number = BigInt(value);
  if (number <= 0n || number >= 2n ** 251n + 17n * 2n ** 192n + 1n) throw new Error("cosigner_wallet_identity_invalid");
  return `0x${number.toString(16)}`;
}
