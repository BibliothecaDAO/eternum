import type { AccountLinkTarget, LedgerAccountLinkWrite } from "@realms-world/identity";
import { normalizeStarknetAddress } from "@realms-world/identity";
import { realmsAccountAddress } from "@realms-world/identity/account";
interface Pins {
  accountClassHash: string;
  guardianPublicKey: string;
}
interface Candidate {
  key: string;
  realmsId: string;
  wallet: string | null;
  historyId: number;
  current: boolean;
  scanId?: number;
}
const ACCOUNT_TARGET = `SELECT 'account:'||u."realmsId" AS key,u."realmsId" AS realmsId,u.address AS wallet,
 COALESCE((SELECT MAX(id) FROM wallet_link_history WHERE account=u."realmsId"),0) AS historyId,1 AS current
 FROM "user" u WHERE u."realmsId" IS NOT NULL AND u."emailVerified"=1`;
const WALLET_TARGET = `SELECT 'wallet:'||h.wallet AS key,COALESCE(u."realmsId",h.account) AS realmsId,h.wallet AS wallet,
 COALESCE((SELECT MAX(id) FROM wallet_link_history WHERE account=u."realmsId" AND wallet=h.wallet),h.id) AS historyId,h.id AS scanId,
 CASE WHEN u."realmsId" IS NULL THEN 0 ELSE 1 END AS current
 FROM wallet_link_history h LEFT JOIN "user" u ON u.address=h.wallet AND u."emailVerified"=1`;
const toTarget = (row: Candidate, pins: Pins): AccountLinkTarget => ({
  key: row.key,
  realmsId: row.realmsId,
  wallet: row.wallet,
  account: row.current ? realmsAccountAddress(row.realmsId, pins.accountClassHash, pins.guardianPublicKey) : null,
  historyId: row.historyId,
});
/** Indexed account and history scans each advance every tick, at most25 targets altogether. */
export const accountLinkTargets = async (db: D1Database, pins: Pins, after: string | null) => {
  const cursor = after ? (JSON.parse(after) as { account: string; history: number }) : { account: "", history: 0 };
  if (typeof cursor.account !== "string" || !Number.isSafeInteger(cursor.history) || cursor.history < 0)
    throw new Error("invalid_identity_link_cursor");
  const accounts = (
    await db
      .prepare(ACCOUNT_TARGET + ' AND u."realmsId">? ORDER BY u."realmsId" LIMIT 13')
      .bind(cursor.account)
      .all<Candidate>()
  ).results;
  const history = (
    await db
      .prepare(WALLET_TARGET + " WHERE h.id>? ORDER BY h.id LIMIT 12")
      .bind(cursor.history)
      .all<Candidate>()
  ).results;
  const account = accounts.length === 13 ? accounts.at(-1)!.realmsId : "";
  const historyAfter = history.length === 12 ? history.at(-1)!.scanId! : 0;
  return {
    rows: [...accounts, ...history].map((row) => toTarget(row, pins)),
    next: account || historyAfter ? JSON.stringify({ account, history: historyAfter }) : null,
  };
};
export const accountLinkTarget = async (db: D1Database, pins: Pins, key: string) => {
  const account = key.startsWith("account:");
  const value = key.slice(account ? 8 : 7);
  if (!account && !key.startsWith("wallet:")) throw new Error("invalid_identity_link_target");
  const query = account
    ? ACCOUNT_TARGET + ' AND u."realmsId"=?'
    : WALLET_TARGET + " WHERE h.wallet=? ORDER BY h.id DESC LIMIT 1";
  const row = await db.prepare(query).bind(value).first<Candidate>();
  if (!row) throw new Error("identity_link_target_missing");
  return toTarget(row, pins);
};

/** A private history receipt ties the exact broadcast to the identity snapshot that authorized it. */
export const recordLedgerLinkWrite = async (
  db: D1Database,
  pins: Pins,
  target: AccountLinkTarget,
  write: LedgerAccountLinkWrite,
) => {
  await requireHistoryAuthority(db, pins, target, write);
  const fields = [write.transactionHash, write.wallet, write.account, write.previousAccount, write.previousWallet].map(
    normalizeStarknetAddress,
  );
  await db
    .prepare(
      `INSERT INTO ledger_link_writes(transaction_hash,wallet,account,previous_account,previous_wallet,authority)
 VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
    )
    .bind(...fields, JSON.stringify(target))
    .run();
  if ((await matchesLedgerLinkWrite(db, pins, write)) !== true) throw new Error("ledger_link_write_differs");
};
export const matchesLedgerLinkWrite = async (db: D1Database, pins: Pins, write: LedgerAccountLinkWrite) => {
  const row = await db
    .prepare("SELECT * FROM ledger_link_writes WHERE transaction_hash=?")
    .bind(normalizeStarknetAddress(write.transactionHash))
    .first<{
      wallet: string;
      account: string;
      previous_account: string;
      previous_wallet: string;
      authority: string;
    }>();
  if (!row) return false;
  if (
    ![
      [row.wallet, write.wallet],
      [row.account, write.account],
      [row.previous_account, write.previousAccount],
      [row.previous_wallet, write.previousWallet],
    ].every(([a, b]) => BigInt(a!) === BigInt(b!))
  )
    return false;
  try {
    await requireHistoryAuthority(db, pins, JSON.parse(row.authority) as AccountLinkTarget, write);
    return true;
  } catch {
    return false;
  }
};
const requireHistoryAuthority = async (
  db: D1Database,
  pins: Pins,
  target: AccountLinkTarget,
  write: LedgerAccountLinkWrite,
) => {
  const own = realmsAccountAddress(target.realmsId, pins.accountClassHash, pins.guardianPublicKey);
  if (target.wallet && BigInt(target.wallet) !== BigInt(write.wallet)) throw new Error("link_wallet_differs");
  if (target.wallet && target.account) {
    if (BigInt(target.account) !== BigInt(own) || BigInt(write.account) !== BigInt(own))
      throw new Error("link_account_differs");
  } else if (BigInt(write.account) !== 0n || (!target.wallet && BigInt(write.previousAccount) !== BigInt(own)))
    throw new Error("link_clear_differs");
  if (target.historyId === 0 && !target.wallet) {
    if (
      !(await db.prepare('SELECT 1 FROM "user" WHERE "realmsId"=? AND "emailVerified"=1').bind(target.realmsId).first())
    )
      throw new Error("link_identity_missing");
    return;
  }
  const history = await db
    .prepare("SELECT account,wallet,replaced_at FROM wallet_link_history WHERE id=?")
    .bind(target.historyId)
    .first<{ account: string; wallet: string; replaced_at: number | null }>();
  if (
    !history ||
    history.account !== target.realmsId ||
    (target.wallet && BigInt(history.wallet) !== BigInt(target.wallet))
  )
    throw new Error("link_history_missing");
  if ((!target.wallet || !target.account) && history.replaced_at === null) throw new Error("link_clear_not_requested");
};
