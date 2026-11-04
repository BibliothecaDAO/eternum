import { supportsDeposits } from "./deposit-destination";
import { rpcAt, readConfirmedLedgerHead } from "@realms-world/value-ledger";
import {
  depositReader,
  depositCommitment,
  depositUint,
  confirmedDepositBlock,
  LORDS_UNIT,
  type LordsDeposit,
} from "@realms-world/value-ledger/deposits";
import { readShardAbi } from "../../../packages/value-ledger/src/shard-abi";
import { readConfirmedSnapshot, optionalRow, type ConfirmedSnapshot } from "./shard-snapshot";
import { type ShardConnection } from "./shard-rpc";

export class DepositConservationFault extends Error {}
const fail = (reason: string): never => {
  throw new DepositConservationFault(reason);
};
type DepositJournal = Awaited<ReturnType<typeof auditDepositLedger>>;
type DepositTarget = { shard: string; gameId: number; games: string };
type LedgerConnection = { rpcUrl: string; address: string; chainId: string };
type PrincipalPayment = { shard: string; gameId: number; account: string; wallet: string; amount: bigint };
const key = (...values: (string | number)[]) => values.map((value) => BigInt(value).toString()).join(":");
const u256 = (fields: readonly string[]) => {
  if (fields.length !== 2) throw new Error("invalid_deposit_u256");
  return depositUint(fields[0]!, 128) + (depositUint(fields[1]!, 128) << 128n);
};

/** Older ledgers have no deposit custody; a configured ledger is audited even when every source shard has retired. */
export async function auditDepositCustody(ledger: LedgerConnection) {
  const provider = rpcAt(ledger.rpcUrl);
  const head = await readConfirmedLedgerHead(provider);
  const abi = await readShardAbi(provider, ledger.address, head.number);
  if (
    !abi.some(
      (item) =>
        item.type === "interface" && item.items?.some((entry: { name?: string }) => entry.name === "deposit_count"),
    )
  )
    return null;
  return auditDepositLedger(ledger);
}

/** The durable journal accounts for deposits, refunds and principal returns even after a source retires. */
export async function auditDepositLedger(ledger: LedgerConnection) {
  const reader = await depositReader(rpcAt(ledger.rpcUrl), ledger.address, ledger.chainId);
  const targets = await readDepositTargets(reader);
  const payments: LordsDeposit[] = [];
  for (const shard of new Set(targets.map((target) => target.shard))) {
    const count = await reader.count(shard);
    for (let id = 1n; id <= count; id++) {
      const payment = await reader.deposit(shard, String(id));
      const target = targets.find((target) => key(target.shard, target.gameId) === key(shard, payment.gameId));
      if (!target || BigInt(target.games) !== BigInt(payment.games)) fail("deposit_target_mismatch");
      payments.push(payment);
    }
  }
  const returns: PrincipalPayment[] = [];
  const accounts = new Map<string, { payment: LordsDeposit; delivered: bigint }>();
  let received = 0n,
    refunded = 0n,
    returned = 0n;
  for (const payment of payments) {
    const amount = BigInt(payment.amount);
    received += amount * LORDS_UNIT;
    if (payment.status === "cancelled") refunded += amount * LORDS_UNIT;
    const identity = key(payment.shard, payment.gameId, payment.account);
    const account = accounts.get(identity) ?? { payment, delivered: 0n };
    if (payment.status === "delivered") account.delivered += amount;
    accounts.set(identity, account);
  }
  for (const { payment, delivered } of accounts.values()) {
    const paid = await reader.principal(payment.shard, payment.gameId, payment.account);
    if (!paid) continue;
    if (BigInt(paid.amount) > delivered) fail("principal_return_exceeds_delivery");
    returned += BigInt(paid.amount) * LORDS_UNIT;
    returns.push({
      shard: payment.shard,
      gameId: payment.gameId,
      account: payment.account,
      wallet: paid.wallet,
      amount: BigInt(paid.amount),
    });
  }
  const principal = await reader.read("deposit_principal", []);
  if (
    principal.length !== 6 ||
    u256(principal.slice(0, 2)) !== received ||
    u256(principal.slice(2, 4)) !== refunded ||
    u256(principal.slice(4, 6)) !== returned
  )
    fail("deposit_principal_journal_mismatch");
  const token = await reader.read("lords", []);
  if (token.length !== 1) throw new Error("invalid_deposit_token");
  const held = await rpcAt(ledger.rpcUrl).callContract(
    { contractAddress: token[0]!, entrypoint: "balance_of", calldata: [ledger.address] },
    reader.head.hash,
  );
  if (refunded + returned > received || u256(held) < received - refunded - returned) fail("deposit_principal_missing");
  await reader.assertCanonical();
  return {
    reader,
    targets,
    payments,
    returns,
    returned: String(returned / LORDS_UNIT),
    principal: String((received - refunded - returned) / LORDS_UNIT),
  };
}
async function readDepositTargets(reader: Awaited<ReturnType<typeof depositReader>>) {
  const count = depositUint((await reader.read("deposit_target_count", []))[0]!, 64);
  const targets: { shard: string; gameId: number; games: string }[] = [];
  const seen = new Set<string>();
  for (let index = 0n; index < count; index++) {
    const fields = await reader.read("deposit_target_at", [String(index)]);
    if (fields.length !== 2) throw new Error("invalid_deposit_target");
    const [shard, game] = fields as [string, string];
    if (seen.has(key(shard, game))) fail("duplicate_deposit_target");
    seen.add(key(shard, game));
    const games = await reader.read("deposit_target", [shard, game]);
    if (games.length !== 1 || BigInt(games[0]!) === 0n) fail("deposit_target_missing");
    targets.push({ shard: key(shard), gameId: Number(depositUint(game, 32)), games: games[0]! });
  }
  return targets;
}
/** Native balances remain the source of current spendable/consumed amounts; the ledger supplies immutable obligations. */
export async function auditDeposits(
  shard: ShardConnection,
  heraldUrl: string,
  ledger: LedgerConnection,
  journal?: Awaited<ReturnType<typeof auditDepositLedger>>,
) {
  if (!(await supportsDeposits(shard))) return [];
  journal ??= await auditDepositLedger(ledger);
  const observations = [];
  for (const target of journal.targets.filter((target) => BigInt(target.shard) === BigInt(shard.chainId))) {
    observations.push(await auditGameDeposits(shard, heraldUrl, ledger, journal, target));
  }
  await journal.reader.assertCanonical();
  return observations;
}

async function auditGameDeposits(
  shard: ShardConnection,
  heraldUrl: string,
  ledger: LedgerConnection,
  journal: DepositJournal,
  target: DepositTarget,
) {
  if (BigInt(target.games) !== BigInt(shard.gamesAddress)) fail("deposit_root_mismatch");
  const snapshot = await readConfirmedSnapshot(shard, heraldUrl, target.gameId, [
    "DepositSource",
    "DepositReceipt",
    "SpendLords",
    "PrincipalWithdrawal",
    "GameRegistry",
  ]);
  const source = optionalRow(snapshot, "DepositSource");
  if (!source) throw new Error("deposit_source_snapshot_pending");
  if (
    BigInt(String(source.chain)) !== BigInt(ledger.chainId) ||
    BigInt(String(source.ledger)) !== BigInt(ledger.address)
  )
    fail("deposit_source_mismatch");
  const block = await confirmedDepositBlock(rpcAt(shard.rpcUrl), undefined, snapshot.confirmed_block);
  const payments = journal.payments.filter(
    (payment) => key(payment.shard, payment.gameId) === key(shard.chainId, target.gameId),
  );
  const totals = auditNativeReceipts(snapshot, payments, ledger);
  const returned = journal.returns.filter(
    (entry) => key(entry.shard, entry.gameId) === key(shard.chainId, target.gameId),
  );
  const balances = auditPrincipalBalances(snapshot, totals, returned);
  await block.assertCanonical();
  return {
    gameId: target.gameId,
    confirmedBlock: snapshot.confirmed_block,
    ...balances,
    principal: journal.principal,
    returned: journal.returned,
  };
}
function auditNativeReceipts(snapshot: ConfirmedSnapshot, payments: LordsDeposit[], ledger: LedgerConnection) {
  const receipts = snapshot.models.find(({ model }) => model === "DepositReceipt")!.rows;
  const totals = new Map<string, bigint>();
  const identities = new Map<string, string>();
  for (const payment of payments) {
    const receipt = receipts.find(({ value }) => BigInt(String(value.id)) === BigInt(payment.id))?.value;
    if (!receipt) {
      if (payment.status !== "pending") throw new Error("deposit_receipt_snapshot_pending");
      continue;
    }
    if (
      BigInt(String(receipt.commitment)) !==
        BigInt(depositCommitment({ chainId: ledger.chainId, ledger: ledger.address }, payment)) ||
      key(String(receipt.account)) !== key(payment.account) ||
      BigInt(String(receipt.amount)) !== BigInt(payment.amount)
    )
      fail("deposit_receipt_mismatch");
    if (typeof receipt.cancelled !== "boolean") throw new Error("invalid_deposit_cancellation");
    if ((payment.status === "delivered" && receipt.cancelled) || (payment.status === "cancelled" && !receipt.cancelled))
      fail("deposit_outcome_mismatch");
    if (!receipt.cancelled) {
      const account = key(payment.account);
      if (identities.has(account) && identities.get(account) !== key(payment.realmsId))
        fail("deposit_identity_mismatch");
      identities.set(account, key(payment.realmsId));
      totals.set(account, (totals.get(account) ?? 0n) + BigInt(payment.amount));
    }
  }
  for (const { value } of receipts)
    if (!payments.some((payment) => BigInt(payment.id) === BigInt(String(value.id))))
      throw new Error("deposit_ledger_snapshot_pending");
  return totals;
}
function auditPrincipalBalances(
  snapshot: ConfirmedSnapshot,
  totals: Map<string, bigint>,
  returned: PrincipalPayment[],
) {
  let available = 0n,
    consumed = 0n,
    swept = 0n,
    unpaidPrincipal = 0;
  const balances = snapshot.models.find(({ model }) => model === "SpendLords")!.rows;
  const withdrawals = snapshot.models.find(({ model }) => model === "PrincipalWithdrawal")!.rows;
  for (const { value } of balances) {
    const account = key(String(value.account));
    const remaining = depositUint(String(value.available), 128);
    const spent = depositUint(String(value.consumed), 128);
    const withdrawn = depositUint(String(value.swept), 128);
    if (remaining + spent + withdrawn !== (totals.get(account) ?? 0n) || (withdrawn > 0n && remaining > 0n))
      fail("spend_lords_conservation");
    totals.delete(account);
    const receipt = withdrawals.find(({ value }) => key(String(value.account)) === account)?.value;
    if (withdrawn > 0n !== Boolean(receipt) || (receipt && depositUint(String(receipt.amount), 128) !== withdrawn))
      fail("principal_receipt_mismatch");
    const paid = returned.find((entry) => key(entry.account) === account);
    if (paid) {
      if (!receipt) throw new Error("principal_snapshot_pending");
      if (paid.amount !== withdrawn) fail("principal_return_mismatch");
    } else if (receipt) unpaidPrincipal++;
    available += remaining;
    consumed += spent;
    swept += withdrawn;
  }
  if ([...totals.values()].some((amount) => amount !== 0n)) fail("spend_lords_balance_missing");
  for (const entry of returned)
    if (!balances.some(({ value }) => key(String(value.account)) === key(entry.account)))
      throw new Error("principal_snapshot_pending");
  for (const { value } of withdrawals)
    if (!balances.some((balance) => key(String(balance.value.account)) === key(String(value.account))))
      fail("principal_balance_missing");
  return { available: String(available), consumed: String(consumed), swept: String(swept), unpaidPrincipal };
}
