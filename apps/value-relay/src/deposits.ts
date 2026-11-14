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

/** Discovery and delivery have separate durable progress: a failed obligation never hides later receipts. */
export async function relayDeposits(ports: DepositRelayPorts) {
  const { target, ledger } = ports;
  if (!(await supportsDeposits(target))) return { enabled: false, processed: 0 };
  const key = `deposits:${BigInt(ledger.chainId)}:${BigInt(ledger.address)}:progress`;
  const stored = await ports.storage.get<DepositProgress>(key);
  const progress: DepositProgress = {
    next: stored?.next ?? "1",
    open: stored?.open ?? stored?.pending ?? [],
    ...(stored?.anchor && { anchor: stored.anchor }),
  };
  const reader = await depositReader(rpcAt(ledger.rpcUrl), ledger.address, ledger.chainId, progress.anchor);
  const count = await reader.count(target.chainId);
  if (BigInt(progress.next) > count + 1n) await forgetVanished(ports, progress, count);
  const discovered = BigInt(progress.next);
  const fresh: string[] = [];
  while (BigInt(progress.next) <= count && fresh.length < 20) {
    fresh.push(progress.next);
    progress.next = String(BigInt(progress.next) + 1n);
  }
  progress.open.push(...fresh);
  await reader.assertCanonical();
  progress.anchor = reader.head;
  await ports.storage.put(key, progress);
  const errors: { obligation: string; error: string }[] = [];
  try {
    await backfillHistory(ports, reader, discovered);
  } catch (cause) {
    if (cause instanceof DepositAnchorError) throw cause;
    errors.push({ obligation: "deposit history", error: cause instanceof Error ? cause.message : String(cause) });
  }
  let accepted: ReturnType<typeof reader.final> | undefined;
  const pass = await driveObligations(
    depositResolution(ports, reader, () => (accepted ??= reader.final())),
    progress.open,
    { finals: ports.finals, state: ports.obligations, proofs: ports.proofs },
  );
  const anchorFault = pass.errors.find(({ error }) => error.startsWith("deposit_head_"));
  if (anchorFault) throw new DepositAnchorError(anchorFault.error);
  errors.push(...pass.errors);
  const settled = new Set(pass.settled);
  progress.open = progress.open.filter((id) => !settled.has(`${BigInt(target.chainId)}:${BigInt(id)}`));
  await ports.storage.put(key, progress);
  return {
    enabled: true,
    processed: pass.attempted,
    next: progress.next,
    total: String(count),
    pending: pass.todo,
    awaiting: pass.awaiting,
    more: BigInt(progress.next) <= count || pass.todo > 0,
    error: errors.length ? errors : null,
  };
}

/**
 * The count went below what was discovered: a replaced block took deposits away. A deposit the shard has not been told of
 * is simply forgotten and discovered again if it comes back; one the shard already credited is a custody fault, loud.
 */
async function forgetVanished(ports: DepositRelayPorts, progress: DepositProgress, count: bigint) {
  const gone = progress.open.filter((id) => BigInt(id) > count);
  for (const id of gone) {
    const row = await ports.storage.get<LordsDeposit>(rowKey(ports.target.chainId, id));
    if (!row || (await shardHasReceipt(ports, row))) throw new DepositAnchorError("deposit_count_regressed");
  }
  for (const id of gone) {
    await ports.storage.delete(rowKey(ports.target.chainId, id));
    await ports.obligations.delete(`obligation:deposit:${BigInt(ports.target.chainId)}:${BigInt(id)}`);
  }
  progress.open = progress.open.filter((id) => BigInt(id) <= count);
  progress.next = String(count + 1n);
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
