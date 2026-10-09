import { normalizeStarknetAddress, type LedgerPayDecision } from "@realms-world/identity";

/** A signed decision records current ready authority atomically before a broadcast can leave the Worker. */
export const recordPayDecision = async (db: D1Database, decision: LedgerPayDecision) => {
  if (await matchesPayDecision(db, decision)) return;
  const value = normalizedDecision(decision);
  const result = await db
    .prepare(
      `INSERT INTO pay_decisions(chain_id,claim_id,transaction_hash,account,wallet,season_id,amount,history_id,evidence_time)
    SELECT ?1,?2,?3,u."realmsId",u.address,?6,?7,h.id,CAST(unixepoch('subsec')*1000 AS INTEGER)
    FROM "user" u JOIN wallet_link_history h ON h.account=u."realmsId" AND h.wallet=u.address
    WHERE u."realmsId"=?4 AND u.address=?5 AND u."emailVerified"=1 AND h.replaced_at IS NULL
    AND h.ready_at<=CAST(unixepoch('subsec')*1000 AS INTEGER)
    ON CONFLICT DO NOTHING`,
    )
    .bind(
      value.chainId,
      value.claimId,
      value.transactionHash,
      value.realmsId,
      value.wallet,
      value.seasonId,
      value.amount,
    )
    .run();
  if (result.meta.changes !== 1 && !(await matchesPayDecision(db, decision))) throw new Error("pay_decision_not_ready");
};

/** Inclusion clocks and later wallet changes cannot invalidate a decision that was ready when signed. */
export const matchesPayDecision = async (db: D1Database, decision: LedgerPayDecision) => {
  const value = normalizedDecision(decision);
  const row = await db
    .prepare(
      `SELECT p.account,p.wallet,p.season_id,p.amount FROM pay_decisions p
    JOIN wallet_link_history h ON h.id=p.history_id AND h.account=p.account AND h.wallet=p.wallet AND h.ready_at<=p.evidence_time
    WHERE p.chain_id=? AND p.claim_id=? AND p.transaction_hash=?`,
    )
    .bind(value.chainId, value.claimId, value.transactionHash)
    .first<{ account: string; wallet: string; season_id: number; amount: string }>();
  return (
    row !== null &&
    row.account === value.realmsId &&
    row.wallet === value.wallet &&
    row.season_id === value.seasonId &&
    row.amount === value.amount
  );
};
const normalizedDecision = (decision: LedgerPayDecision) => {
  if (
    !Number.isSafeInteger(decision.seasonId) ||
    decision.seasonId <= 0 ||
    decision.seasonId > 0xffffffff ||
    BigInt(decision.amount) <= 0n ||
    BigInt(decision.amount) >= 2n ** 256n
  )
    throw new Error("invalid_pay_decision");
  return {
    ...decision,
    chainId: normalizeStarknetAddress(decision.chainId),
    claimId: normalizeStarknetAddress(decision.claimId),
    transactionHash: normalizeStarknetAddress(decision.transactionHash),
    wallet: normalizeStarknetAddress(decision.wallet),
    amount: String(BigInt(decision.amount)),
  };
};
