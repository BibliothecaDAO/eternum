import { readDepositEvidence, depositDestinationError, supportsDeposits } from "./deposit-destination";
import {
  depositReader,
  depositCommitment,
  depositUint,
  confirmedDepositBlock,
  DepositAnchorError,
  type DepositAnchor,
  type DepositSigningRequest,
  type LordsDeposit,
} from "@realms-world/value-ledger/deposits";
import { rpcAt, type Cosignature } from "@realms-world/value-ledger";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { type ShardConnection } from "./shard-rpc";
import { verifyDepositResolution } from "./deposit-verifier";
import { driveObligations, type ObligationKind, type ObligationState } from "./obligations";
import type { FinalFacts } from "./final-facts";

export type DepositMutation =
  | { kind: "resolve"; shard: string; id: string; cancelled: boolean }
  | Omit<Extract<DepositSigningRequest, { kind: "principal" }>, "wallet">;
export interface DepositRelayPorts {
  target: ShardTarget & ShardConnection;
  heraldUrl: string;
  ledger: { rpcUrl: string; address: string; chainId: string };
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<unknown>;
    delete(key: string): Promise<unknown>;
    transaction<A>(
      run: (tx: {
        put(key: string, value: unknown): Promise<unknown>;
        delete(key: string): Promise<unknown>;
      }) => Promise<A>,
    ): Promise<A>;
    list<T>(options: { prefix: string; reverse?: boolean; limit?: number; end?: string }): Promise<Map<string, T>>;
  };
  sign(request: DepositSigningRequest): Promise<Cosignature>;
  finals: FinalFacts;
  obligations: ObligationState;
  /** A proof pass attempts deposits whose resolution awaits the accepted block; a plain pass leaves them. */
  proofs: boolean;
  mutate(request: DepositMutation): Promise<unknown>;
}

/** What a queued deposit is: the id the ledger gave it and the commitment to what was paid. An id can be reused; this cannot. */
interface OpenDeposit {
  id: string;
  commitment: string;
}
interface DepositProgress {
  next: string;
  /** Deposits discovered and not yet settled: the work queue. Only final evidence takes one out. */
  open: OpenDeposit[];
  /** The name this queue had before it was one. */
  pending?: string[];
  anchor?: DepositAnchor;
}
/** A deposit the shard credited that the ledger no longer has, kept with what is needed to investigate it. */
interface DepositFault {
  id: string;
  commitment: string;
  row: LordsDeposit;
  reason: "vanished_after_credit" | "replaced_after_credit";
  since: number;
}
const faultKey = (shard: string, commitment: string) => `deposit-fault:${BigInt(shard)}:${commitment}`;
/** An operator's answer to a fault, once the shard's credit has been dealt with: this fault goes, nothing else does. */
export async function clearDepositFault(
  storage: Pick<DepositRelayPorts["storage"], "get" | "put" | "delete">,
  shard: string,
  commitment: string,
  reason: string,
) {
  const fault = await storage.get<DepositFault>(faultKey(shard, commitment));
  if (!fault) throw new Error("deposit_fault_unknown");
  await storage.put(`deposit-fault-cleared:${BigInt(shard)}:${commitment}`, {
    ...fault,
    reason: fault.reason,
    cleared: reason,
    at: Date.now(),
  });
  await storage.delete(faultKey(shard, commitment));
  return fault;
}
const commitmentOf = (ports: Pick<DepositRelayPorts, "ledger">, payment: LordsDeposit) =>
  depositCommitment({ chainId: ports.ledger.chainId, ledger: ports.ledger.address }, payment);
const keyOf = (ports: DepositRelayPorts, entry: OpenDeposit) =>
  `${BigInt(ports.target.chainId)}:${BigInt(entry.id)}:${entry.commitment}`;

/**
 * A deposit is an obligation: deliver it to the shard (or refund it) and resolve it on the ledger. It stays in `open`
 * until the accepted ledger block shows the resolution; a pass that ends, a receipt accepted on L2, or a delivery that
 * returned remove nothing. A rewritten block shows the resolution gone at the head, and the next attempt does it again.
 * It is identified by its commitment, not its id: when the ledger gives its id to a different deposit, the attempt finds
 * a different commitment at that id and reports it replaced instead of delivering the other deposit under its name.
 */
const depositResolution = (
  ports: DepositRelayPorts,
  reader: Awaited<ReturnType<typeof depositReader>>,
  finalOf: () => Promise<Awaited<ReturnType<typeof reader.final>>>,
  replaced: { entry: OpenDeposit; payment: LordsDeposit }[],
): ObligationKind<OpenDeposit> => ({
  name: "deposit",
  key: (entry) => `${BigInt(ports.target.chainId)}:${BigInt(entry.id)}:${entry.commitment}`,
  attempt: async (entry) => {
    await reader.assertCanonical();
    const payment = await reader.deposit(ports.target.chainId, entry.id);
    if (entry.commitment && commitmentOf(ports, payment) !== entry.commitment) {
      replaced.push({ entry, payment });
      throw new Error("deposit_replaced");
    }
    await remember(ports, payment);
    let status = payment.status;
    if (status === "pending") {
      const cancelled = await deliverPayment(ports, payment, reader.assertCanonical);
      status = cancelled ? "cancelled" : "delivered";
      await remember(ports, { ...payment, status });
    }
    // A read at the accepted block that fails keeps nothing: the head's answer stands and the proof pass tries again.
    const accepted = await Promise.resolve()
      .then(finalOf)
      .then(async (final) => ({ block: final.block, settled: await final.deposit(ports.target.chainId, entry.id) }))
      .catch(() => null);
    return {
      final: accepted?.settled.status === status ? { block: accepted.block.number, hash: accepted.block.hash } : null,
    };
  },
});

/**
 * Discovery and delivery have separate durable progress: a failed obligation never hides later receipts. Two writes that
 * must agree are one transaction: a deposit enters the queue together with its history row, and a vanished or replaced
 * deposit leaves it together with its row, its state and the cursor, so a worker killed anywhere can resume from what is
 * stored.
 */
export async function relayDeposits(ports: DepositRelayPorts) {
  const { target, ledger } = ports;
  if (!(await supportsDeposits(target)))
    return { enabled: false, processed: 0, pending: 0, awaiting: 0, more: false, error: null, faults: [] as string[] };
  const key = `deposits:${BigInt(ledger.chainId)}:${BigInt(ledger.address)}:progress`;
  const stored = await ports.storage.get<Omit<DepositProgress, "open"> & { open?: (OpenDeposit | string)[] }>(key);
  let progress: DepositProgress = {
    next: stored?.next ?? "1",
    open: await Promise.all(
      (stored?.open ?? stored?.pending ?? []).map(async (entry) => {
        if (typeof entry !== "string") return entry;
        const row = await ports.storage.get<LordsDeposit>(rowKey(target.chainId, entry));
        return { id: entry, commitment: row ? commitmentOf(ports, row) : "" };
      }),
    ),
    ...(stored?.anchor && { anchor: stored.anchor }),
  };
  const reader = await depositReader(rpcAt(ledger.rpcUrl), ledger.address, ledger.chainId, progress.anchor);
  const count = await reader.count(target.chainId);
  const errors: { obligation: string; error: string }[] = [];
  if (BigInt(progress.next) > count + 1n) progress = await reconcileVanished(ports, key, progress, count);
  const discovered = BigInt(progress.next);
  const fresh: LordsDeposit[] = [];
  for (let id = discovered; id <= count && fresh.length < 20; id++) {
    try {
      fresh.push(await reader.deposit(target.chainId, String(id)));
    } catch (cause) {
      errors.push({ obligation: `deposit:${id}`, error: cause instanceof Error ? cause.message : String(cause) });
      break;
    }
  }
  await reader.assertCanonical();
  progress = {
    ...progress,
    next: String(discovered + BigInt(fresh.length)),
    open: [...progress.open, ...fresh.map((payment) => ({ id: payment.id, commitment: commitmentOf(ports, payment) }))],
    anchor: reader.head,
  };
  await commit(ports, key, progress, fresh);
  try {
    await backfillHistory(ports, reader, discovered);
  } catch (cause) {
    if (cause instanceof DepositAnchorError) throw cause;
    errors.push({ obligation: "deposit history", error: cause instanceof Error ? cause.message : String(cause) });
  }
  let accepted: ReturnType<typeof reader.final> | undefined;
  const replaced: { entry: OpenDeposit; payment: LordsDeposit }[] = [];
  const pass = await driveObligations(
    depositResolution(ports, reader, () => (accepted ??= reader.final()), replaced),
    progress.open,
    { finals: ports.finals, state: ports.obligations, proofs: ports.proofs },
  );
  const anchorFault = pass.errors.find(({ error }) => error.startsWith("deposit_head_"));
  if (anchorFault) throw new DepositAnchorError(anchorFault.error);
  errors.push(...pass.errors.filter(({ error }) => error !== "deposit_replaced"));
  const settled = new Set(pass.settled);
  progress = { ...progress, open: progress.open.filter((entry) => !settled.has(keyOf(ports, entry))) };
  if (replaced.length) progress = await reconcileReplaced(ports, key, progress, replaced);
  else await ports.storage.put(key, progress);
  return {
    enabled: true,
    processed: pass.attempted,
    total: String(count),
    ...(await summarize(ports, progress, count, errors)),
  };
}

/**
 * What a pass says about the work, derived from the store after everything the pass did, and nowhere else: the worker
 * decides from this whether the next minute has anything to do, so it must describe the queue as it now stands. A queued
 * deposit with no awaiting marker still needs an attempt (new, replaced, or failed); one with the marker waits for a
 * proof pass; a fault needs an operator and an attempt would change nothing.
 */
async function summarize(
  ports: DepositRelayPorts,
  progress: DepositProgress,
  count: bigint,
  errors: { obligation: string; error: string }[],
) {
  let todo = 0;
  let awaiting = 0;
  for (const entry of progress.open)
    if ((await ports.obligations.get<true>(`obligation:deposit:${keyOf(ports, entry)}`)) === true) awaiting++;
    else todo++;
  const faults = await ports.storage.list<DepositFault>({ prefix: `deposit-fault:${BigInt(ports.target.chainId)}:` });
  return {
    next: progress.next,
    pending: todo,
    awaiting,
    faults: [...faults.values()].map((fault) => `deposit_${fault.reason}:${fault.id}:${fault.commitment}`),
    more: BigInt(progress.next) <= count || todo > 0,
    error: errors.length ? errors : null,
  };
}

/** Whether the last pass left nothing for the next minute: no queued deposit to attempt, nothing failing, nothing to discover. */
export const depositsSettled = (last: { error?: unknown; pending?: number | undefined; more?: boolean | undefined }) =>
  !last.error && !last.pending && !last.more;

/** A deposit enters the queue with its history row, or not at all. */
const commit = (ports: DepositRelayPorts, key: string, progress: DepositProgress, rows: readonly LordsDeposit[]) =>
  ports.storage.transaction(async (tx) => {
    for (const row of rows) await tx.put(rowKey(row.shard, row.id), row);
    await tx.put(key, progress);
  });

/**
 * Whether a deposit that left the chain was already credited on the shard. If it was, what is needed to investigate it is
 * kept under its commitment, apart from the queue and from the history row its id will be given to next; if not, it is
 * simply forgotten.
 */
async function leaveQueue(ports: DepositRelayPorts, entry: OpenDeposit, reason: DepositFault["reason"]) {
  const row = await ports.storage.get<LordsDeposit>(rowKey(ports.target.chainId, entry.id));
  const credited = !row || (await shardHasReceipt(ports, row));
  return credited && row
    ? ({ id: entry.id, commitment: entry.commitment, row, reason, since: Date.now() } as DepositFault)
    : null;
}

/**
 * The count went below what was discovered: a replaced block took deposits away. Each leaves the queue with its row and
 * state and the cursor rewinds, in one transaction; one the shard already credited is kept as a fault under its
 * commitment, reported on every pass, and stops nothing: a new deposit that takes its id is a different obligation.
 */
async function reconcileVanished(
  ports: DepositRelayPorts,
  key: string,
  progress: DepositProgress,
  count: bigint,
): Promise<DepositProgress> {
  const gone = progress.open.filter((entry) => BigInt(entry.id) > count);
  const faults = new Map<string, DepositFault>();
  for (const entry of gone) {
    const fault = await leaveQueue(ports, entry, "vanished_after_credit");
    if (fault) faults.set(entry.commitment, fault);
  }
  const next: DepositProgress = {
    ...progress,
    open: progress.open.filter((entry) => !gone.includes(entry)),
    next: String(count + 1n),
  };
  await ports.storage.transaction(async (tx) => {
    for (const entry of gone) {
      await tx.delete(rowKey(ports.target.chainId, entry.id));
      await tx.delete(`obligation:deposit:${keyOf(ports, entry)}`);
    }
    for (const fault of faults.values()) await tx.put(faultKey(ports.target.chainId, fault.commitment), fault);
    await tx.put(key, next);
  });
  return next;
}

/**
 * The ledger gave a queued deposit's id to a different deposit. The old one leaves the queue (kept as a fault if the shard
 * credited it) and the new one enters it with its row, in one transaction; the new one is then attempted on its own terms,
 * and a genuine commitment conflict with a receipt on the shard fails loudly for it alone.
 */
async function reconcileReplaced(
  ports: DepositRelayPorts,
  key: string,
  progress: DepositProgress,
  replaced: readonly { entry: OpenDeposit; payment: LordsDeposit }[],
): Promise<DepositProgress> {
  const faults: DepositFault[] = [];
  for (const { entry } of replaced) {
    const fault = await leaveQueue(ports, entry, "replaced_after_credit");
    if (fault) faults.push(fault);
  }
  const gone = new Set(replaced.map(({ entry }) => entry));
  const next: DepositProgress = {
    ...progress,
    open: [
      ...progress.open.filter((entry) => !gone.has(entry)),
      ...replaced.map(({ payment }) => ({ id: payment.id, commitment: commitmentOf(ports, payment) })),
    ],
  };
  await ports.storage.transaction(async (tx) => {
    for (const { entry } of replaced) await tx.delete(`obligation:deposit:${keyOf(ports, entry)}`);
    for (const fault of faults) await tx.put(faultKey(ports.target.chainId, fault.commitment), fault);
    for (const { payment } of replaced) await tx.put(rowKey(payment.shard, payment.id), payment);
    await tx.put(key, next);
  });
  return next;
}

const shardReceipt = async (ports: DepositRelayPorts, payment: Pick<LordsDeposit, "gameId" | "id">) => {
  const block = await confirmedDepositBlock(rpcAt(ports.target.rpcUrl));
  const receipt = await new ShardOperator(ports.target).provider.callContract(
    {
      contractAddress: ports.target.gamesAddress,
      entrypoint: "deposit_receipt",
      calldata: [String(payment.gameId), payment.id],
    },
    block.head.hash,
  );
  await block.assertCanonical();
  return receipt;
};
const shardHasReceipt = async (ports: DepositRelayPorts, payment: Pick<LordsDeposit, "gameId" | "id">) => {
  const receipt = await shardReceipt(ports, payment);
  return !(receipt.length === 1 && BigInt(receipt[0]!) === 1n);
};

async function deliverPayment(
  ports: DepositRelayPorts,
  payment: LordsDeposit,
  assertCanonical: () => Promise<void>,
): Promise<boolean> {
  const { target, ledger } = ports;
  if (BigInt(payment.games) !== BigInt(target.gamesAddress)) throw new Error("deposit_games_differs");
  const operator = new ShardOperator(target);
  const read = () => shardReceipt(ports, payment);
  let receipt = await read();
  const commitment = depositCommitment({ chainId: ledger.chainId, ledger: ledger.address }, payment);
  if (receipt.length === 1 && BigInt(receipt[0]!) === 1n) {
    const cancel = !(await canDeliver(ports, payment));
    const signature = await ports.sign({
      kind: "deposit",
      shard: target.chainId,
      season: payment.gameId,
      id: payment.id,
      cancel,
    });
    await assertCanonical();
    await operator.admin("deliver_deposit", {
      game_id: payment.gameId,
      deposit: {
        id: payment.id,
        account: payment.account,
        realms_id: payment.realmsId,
        home: payment.home,
        payer: payment.payer,
        amount: payment.amount,
        paid_at: payment.paidAt,
      },
      ...signature,
      cancel,
    });
    receipt = await read();
  }
  const cancelled = verifyDepositResolution(receipt, commitment, payment);
  await ports.mutate({ kind: "resolve", shard: target.chainId, id: payment.id, cancelled });
  return cancelled;
}

/** Deposits the relay discovered before it kept history are read once, so the page's history is complete. */
async function backfillHistory(
  ports: DepositRelayPorts,
  reader: Awaited<ReturnType<typeof depositReader>>,
  discovered: bigint,
) {
  const done = `deposits:${BigInt(ports.ledger.chainId)}:${BigInt(ports.ledger.address)}:history`;
  if (await ports.storage.get(done)) return;
  for (let id = 1n; id < discovered; id++)
    if ((await ports.storage.get(rowKey(ports.target.chainId, id))) === undefined)
      await remember(ports, await reader.deposit(ports.target.chainId, String(id)));
  await ports.storage.put(done, true);
}

async function canDeliver(ports: DepositRelayPorts, payment: LordsDeposit) {
  const evidence = await readDepositEvidence({ ...ports.target, heraldUrl: ports.heraldUrl }, payment.gameId, {
    getAnchor: (key) => ports.storage.get(key),
    putAnchor: async (key, value) => {
      await ports.storage.put(key, value);
    },
  });
  const error = await depositDestinationError(evidence, payment);
  await evidence.remember();
  return error === null;
}

const rowKey = (shard: string, id: bigint | string) =>
  `deposit-row:${BigInt(shard)}:${BigInt(id).toString().padStart(20, "0")}`;
const remember = (ports: Pick<DepositRelayPorts, "storage">, payment: LordsDeposit) =>
  ports.storage.put(rowKey(payment.shard, payment.id), payment);

/**
 * A player's deposits, from what the relay has already read: each deposit it discovered, with its status as of the
 * last time the relay looked or acted on it. The page asks every few seconds; the chain is not read to answer.
 */
export async function depositHistory(
  ports: Pick<DepositRelayPorts, "target" | "storage">,
  realmsId: string,
  before?: string,
) {
  const shard = ports.target.chainId;
  const prefix = `deposit-row:${BigInt(shard)}:`;
  const newest = before ? depositUint(before, 64) : undefined;
  const page = await ports.storage.list<LordsDeposit>({
    prefix,
    reverse: true,
    limit: 50,
    ...(newest !== undefined && { end: rowKey(shard, newest + 1n) }),
  });
  const stored = [...page.entries()];
  const rows = stored.map(([, payment]) => payment).filter((payment) => BigInt(payment.realmsId) === BigInt(realmsId));
  const oldest = stored.length === 50 ? BigInt(stored.at(-1)![1].id) - 1n : 0n;
  return { rows, next: oldest > 0n ? String(oldest) : null };
}
