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

export type DepositMutation =
  | { kind: "resolve"; shard: string; id: string; cancelled: boolean }
  | Omit<Extract<DepositSigningRequest, { kind: "principal" }>, "wallet">;
export interface DepositRelayPorts {
  target: ShardTarget & ShardConnection;
  heraldUrl: string;
  ledger: { rpcUrl: string; address: string; chainId: string };
  storage: { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<unknown> };
  sign(request: DepositSigningRequest): Promise<Cosignature>;
  mutate(request: DepositMutation): Promise<void>;
}

interface DepositProgress {
  next: string;
  pending: string[];
  anchor?: DepositAnchor;
}

/** Discovery and delivery have separate durable progress: a failed obligation never hides later receipts. */
export async function relayDeposits(ports: DepositRelayPorts) {
  const { target, ledger } = ports;
  if (!(await supportsDeposits(target))) return { enabled: false, processed: 0 };
  const key = `deposits:${BigInt(ledger.chainId)}:${BigInt(ledger.address)}:progress`;
  const progress = (await ports.storage.get<DepositProgress>(key)) ?? { next: "1", pending: [] };
  const reader = await depositReader(rpcAt(ledger.rpcUrl), ledger.address, ledger.chainId, progress.anchor);
  const count = await reader.count(target.chainId);
  if (BigInt(progress.next) > count + 1n) throw new DepositAnchorError("deposit_count_regressed");
  const fresh: string[] = [];
  while (BigInt(progress.next) <= count && fresh.length < 20) {
    fresh.push(progress.next);
    progress.next = String(BigInt(progress.next) + 1n);
  }
  const retry = progress.pending.slice(0, 20);
  progress.pending.push(...fresh);
  await reader.assertCanonical();
  progress.anchor = reader.head;
  await ports.storage.put(key, progress);
  const errors: { obligation: string; error: string }[] = [];
  const attempt = async (obligation: string, work: () => Promise<void>) => {
    try {
      await reader.assertCanonical();
      await work();
    } catch (cause) {
      if (cause instanceof DepositAnchorError) throw cause;
      errors.push({ obligation, error: cause instanceof Error ? cause.message : String(cause) });
    }
  };
  let processed = 0;
  for (const id of [...retry, ...fresh]) {
    await attempt(`deposit:${id}`, async () => {
      const payment = await reader.deposit(target.chainId, id);
      if (payment.status === "pending") await deliverPayment(ports, payment, reader.assertCanonical);
      progress.pending = progress.pending.filter((pending) => pending !== id);
      processed++;
    });
  }
  // Rotate failed old obligations so a bounded retry batch cannot starve newer failures.
  progress.pending = [
    ...progress.pending.filter((id) => !retry.includes(id)),
    ...retry.filter((id) => progress.pending.includes(id)),
  ];
  await ports.storage.put(key, progress);
  return {
    enabled: true,
    processed,
    next: progress.next,
    total: String(count),
    pending: progress.pending.length,
    more: BigInt(progress.next) <= count || progress.pending.length > 0,
    error: errors.length ? errors : null,
  };
}

async function deliverPayment(ports: DepositRelayPorts, payment: LordsDeposit, assertCanonical: () => Promise<void>) {
  const { target, ledger } = ports;
  if (BigInt(payment.games) !== BigInt(target.gamesAddress)) throw new Error("deposit_games_differs");
  const operator = new ShardOperator(target);
  const read = async () => {
    const block = await confirmedDepositBlock(rpcAt(target.rpcUrl));
    const receipt = await operator.provider.callContract(
      {
        contractAddress: target.gamesAddress,
        entrypoint: "deposit_receipt",
        calldata: [String(payment.gameId), payment.id],
      },
      block.head.hash,
    );
    await block.assertCanonical();
    return receipt;
  };
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

export async function depositHistory(
  ports: Pick<DepositRelayPorts, "target" | "ledger">,
  realmsId: string,
  before?: string,
) {
  const reader = await depositReader(rpcAt(ports.ledger.rpcUrl), ports.ledger.address, ports.ledger.chainId);
  const count = await reader.count(ports.target.chainId);
  let id = before ? depositUint(before, 64) : count;
  if (id > count) throw new Error("deposit_page_out_of_range");
  const rows: LordsDeposit[] = [];
  for (let scanned = 0; id > 0n && scanned < 50; scanned++, id--) {
    const receipt = await reader.deposit(ports.target.chainId, String(id));
    if (BigInt(receipt.realmsId) === BigInt(realmsId)) rows.push(receipt);
  }
  return { rows, next: id > 0n ? String(id) : null };
}
