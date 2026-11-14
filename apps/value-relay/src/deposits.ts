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

interface DepositProgress {
  next: string;
  /** Deposits discovered and not yet settled: the work queue. Only final evidence takes one out. */
  open: string[];
  /** Deposits the shard credited and the ledger no longer has: quarantined, reported every pass, never retried. */
  vanished: string[];
  /** The name this queue had before it was one. */
  pending?: string[];
  anchor?: DepositAnchor;
}

/**
 * A deposit is an obligation: deliver it to the shard (or refund it) and resolve it on the ledger. It stays in `open`
 * until the accepted ledger block shows the resolution; a pass that ends, a receipt accepted on L2, or a delivery that
 * returned remove nothing. A rewritten block shows the resolution gone at the head, and the next attempt does it again.
 */
const depositResolution = (
  ports: DepositRelayPorts,
  reader: Awaited<ReturnType<typeof depositReader>>,
  finalOf: () => Promise<Awaited<ReturnType<typeof reader.final>>>,
): ObligationKind<string> => ({
  name: "deposit",
  key: (id) => `${BigInt(ports.target.chainId)}:${BigInt(id)}`,
  attempt: async (id) => {
    await reader.assertCanonical();
    const payment = await reader.deposit(ports.target.chainId, id);
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
      .then(
        async (final) => ({ block: final.block, settled: await final.deposit(ports.target.chainId, id) }),
        () => null,
      );
    return {
      final: accepted?.settled.status === status ? { block: accepted.block.number, hash: accepted.block.hash } : null,
    };
  },
});

/**
 * Discovery and delivery have separate durable progress: a failed obligation never hides later receipts. Two writes that
 * must agree are one transaction: a deposit enters the queue together with its history row, and a vanished deposit leaves
 * it together with its row, its state and the rewound cursor, so a worker killed anywhere can resume from what is stored.
 */
export async function relayDeposits(ports: DepositRelayPorts) {
  const { target, ledger } = ports;
  if (!(await supportsDeposits(target))) return { enabled: false, processed: 0 };
  const key = `deposits:${BigInt(ledger.chainId)}:${BigInt(ledger.address)}:progress`;
  const stored = await ports.storage.get<DepositProgress>(key);
  let progress: DepositProgress = {
    next: stored?.next ?? "1",
    open: stored?.open ?? stored?.pending ?? [],
    vanished: stored?.vanished ?? [],
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
    open: [...progress.open, ...fresh.map(({ id }) => id)],
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
  const quarantined = new Set(progress.vanished);
  const pass = await driveObligations(
    depositResolution(ports, reader, () => (accepted ??= reader.final())),
    progress.open.filter((id) => !quarantined.has(id)),
    { finals: ports.finals, state: ports.obligations, proofs: ports.proofs },
  );
  const anchorFault = pass.errors.find(({ error }) => error.startsWith("deposit_head_"));
  if (anchorFault) throw new DepositAnchorError(anchorFault.error);
  errors.push(...pass.errors);
  for (const id of progress.vanished)
    errors.push({ obligation: `deposit:${id}`, error: "deposit_vanished_after_credit" });
  const settled = new Set(pass.settled);
  progress = {
    ...progress,
    open: progress.open.filter((id) => !settled.has(`${BigInt(target.chainId)}:${BigInt(id)}`)),
  };
  await ports.storage.put(key, progress);
  return {
    enabled: true,
    processed: pass.attempted,
    next: progress.next,
    total: String(count),
    pending: pass.todo + progress.vanished.length,
    awaiting: pass.awaiting,
    more: BigInt(progress.next) <= count || pass.todo > 0,
    error: errors.length ? errors : null,
  };
}

/** A deposit enters the queue with its history row, or not at all. */
const commit = (ports: DepositRelayPorts, key: string, progress: DepositProgress, rows: readonly LordsDeposit[]) =>
  ports.storage.transaction(async (tx) => {
    for (const row of rows) await tx.put(rowKey(row.shard, row.id), row);
    await tx.put(key, progress);
  });

/**
 * The count went below what was discovered: a replaced block took deposits away. A deposit the shard has not been told of
 * is forgotten, with its row and state and the rewound cursor in one transaction, and discovered again if it comes back.
 * One the shard already credited is a custody fault: it is quarantined, reported on every pass, and stops nothing else.
 */
async function reconcileVanished(
  ports: DepositRelayPorts,
  key: string,
  progress: DepositProgress,
  count: bigint,
): Promise<DepositProgress> {
  const gone = progress.open.filter((id) => BigInt(id) > count && !progress.vanished.includes(id));
  const forgotten: string[] = [];
  const credited: string[] = [];
  for (const id of gone) {
    const row = await ports.storage.get<LordsDeposit>(rowKey(ports.target.chainId, id));
    (row && !(await shardHasReceipt(ports, row)) ? forgotten : credited).push(id);
  }
  const next: DepositProgress = {
    ...progress,
    open: progress.open.filter((id) => !forgotten.includes(id)),
    vanished: [...progress.vanished, ...credited],
    next: String(count + 1n),
  };
  await ports.storage.transaction(async (tx) => {
    for (const id of forgotten) {
      await tx.delete(rowKey(ports.target.chainId, id));
      await tx.delete(`obligation:deposit:${BigInt(ports.target.chainId)}:${BigInt(id)}`);
    }
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
