import type { BlitzResult, ConfirmedBlock, Withdrawal, HeldObligation } from "./ports";

export interface RelayProgress {
  nextBlock: number;
  lastHash: string | null;
  halted: string | null;
  page?: { head: number; hash: string; token: string } | null;
}
interface BlockAnchor {
  number: number;
  hash: string;
}
export interface RelayStore {
  progress(): Promise<RelayProgress>;
  observe(block: ConfirmedBlock): Promise<void>;
  withdrawals(): Promise<readonly Withdrawal[]>;
  results(): Promise<readonly BlitzResult[]>;
  completeWithdrawal(transactionHash: string): Promise<void>;
  completeResult(gameId: number): Promise<void>;
  halt(reason: string): Promise<void>;
  held(): Promise<readonly HeldObligation[]>;
  heldRecovery(): Promise<readonly HeldObligation[]>;
  hold(obligation: HeldObligation): Promise<void>;
  restoreWithdrawal(withdrawal: Withdrawal): Promise<void>;
}

/** The relay's cursor advances with durable obligations, so a restart loses neither a receipt nor a result. */
export class DurableRelayStore implements RelayStore {
  constructor(private readonly storage: DurableObjectStorage) {}

  async progress(): Promise<RelayProgress> {
    return (await this.storage.get<RelayProgress>("progress")) ?? { nextBlock: 0, lastHash: null, halted: null };
  }
  async observe(block: ConfirmedBlock): Promise<void> {
    const anchors = block.anchors ?? [{ number: block.number, hash: block.hash }];
    const from = block.fromBlock ?? block.number;
    if (
      anchors.length !== block.number - from + 1 ||
      anchors.some((anchor, index) => anchor.number !== from + index) ||
      BigInt(anchors.at(-1)!.hash) !== BigInt(block.hash)
    )
      throw new Error("incomplete_block_anchors");
    await this.storage.transaction(async (tx) => {
      for (const anchor of anchors) {
        const stored = await tx.get<string>(blockKey(anchor.number));
        if (stored && BigInt(stored) !== BigInt(anchor.hash)) throw new Error("observed_block_changed");
        await tx.put(blockKey(anchor.number), anchor.hash);
      }
      for (const withdrawal of block.withdrawals) {
        await indexObligation(tx, `withdrawal:${withdrawal.transactionHash}`, withdrawal.blockNumber ?? block.number);
        await tx.put(`withdrawal:${withdrawal.transactionHash}`, {
          ...withdrawal,
          blockNumber: withdrawal.blockNumber ?? block.number,
        });
      }
      for (const result of block.results) {
        await indexObligation(tx, `result:${result.gameId}`, result.blockNumber ?? block.number);
        await tx.put(`result:${result.gameId}`, { ...result, blockNumber: result.blockNumber ?? block.number });
      }
      for (const held of block.held ?? []) {
        await indexObligation(tx, heldKey(held), obligationBlock(held) ?? 0);
        await tx.put(heldKey(held), held);
      }
      const previous = (await tx.get<RelayProgress>("progress")) ?? { nextBlock: 0, lastHash: null, halted: null };
      const progress: RelayProgress = {
        ...previous,
        nextBlock: block.next ? block.fromBlock! : block.number + 1,
        lastHash: block.next ? previous.lastHash : block.hash,
        page: block.next ? { head: block.number, hash: block.hash, token: block.next } : null,
        halted: null,
      };
      await tx.put("progress", progress);
      await pruneBlockAnchors(tx, progress);
    });
  }
  async withdrawals() {
    return this.queuePage<Withdrawal>("withdrawal:");
  }
  async results() {
    return this.queuePage<BlitzResult>("result:");
  }
  async completeWithdrawal(transactionHash: string) {
    await this.storage.transaction(async (tx) => {
      const withdrawal = await tx.get<Withdrawal>(`withdrawal:${transactionHash}`);
      if (withdrawal) {
        await tx.put(`paid:${transactionHash}`, withdrawal);
        await tx.delete(obligationIndexKey(`withdrawal:${transactionHash}`, withdrawal.blockNumber ?? 0));
      }
      await tx.delete(`withdrawal:${transactionHash}`);
    });
  }
  async completeResult(gameId: number) {
    await this.storage.transaction(async (tx) => {
      const result = await tx.get<BlitzResult>(`result:${gameId}`);
      if (result) await tx.delete(obligationIndexKey(`result:${gameId}`, result.blockNumber ?? 0));
      await tx.delete(`result:${gameId}`);
    });
  }
  async halt(reason: string) {
    await this.storage.put("progress", { ...(await this.progress()), halted: reason });
  }
  async resetFromChain(
    row: string,
    reason: string,
    chain: { head(): Promise<number>; hash(number: number): Promise<string> },
  ) {
    const previous = await this.progress();
    if (previous.halted !== row) throw new Error("fault_row_mismatch");
    const named =
      row === "confirmed_head_regressed"
        ? (previous.page?.head ?? previous.nextBlock - 1)
        : Number(row.split(":").at(-1));
    if (!Number.isSafeInteger(named) || named < 0) throw new Error("fault_row_checkpoint_differs");
    const queued = [
      ...(await listStoredValues(this.storage, "withdrawal:")),
      ...(await listStoredValues(this.storage, "result:")),
      ...(await listStoredValues(this.storage, "held:")),
    ];
    const hasLegacyRows = queued.some((value) => obligationBlock(value) === undefined);
    const head = await chain.head();
    let fork: BlockAnchor | null = null;
    const top = Math.min(named, head, previous.page?.head ?? previous.nextBlock - 1);
    let end = blockKey(top + 1);
    while (!hasLegacyRows && !fork && top >= 0) {
      const anchors = await this.storage.list<string>({ prefix: "block:", end, reverse: true, limit: 1000 });
      for (const [key, stored] of anchors) {
        const number = Number(key.slice(6));
        if (BigInt(stored) === BigInt(await chain.hash(number))) {
          fork = { number, hash: stored };
          break;
        }
      }
      if (anchors.size < 1000) break;
      end = [...anchors.keys()].at(-1)!;
    }
    if (fork && BigInt(await chain.hash(fork.number)) !== BigInt(fork.hash)) throw new Error("reset_anchor_changed");
    return this.reset(row, reason, fork);
  }
  async reset(row: string, reason: string, fork: BlockAnchor | null) {
    if (!reason.trim() || reason.length > 500) throw new Error("reset_reason_required");
    return this.storage.transaction(async (tx) => {
      const previous = await tx.get<RelayProgress>("progress");
      if (!previous || previous.halted !== row) throw new Error("fault_row_mismatch");
      if (fork) {
        const stored = await tx.get<string>(blockKey(fork.number));
        if (!stored || BigInt(stored) !== BigInt(fork.hash)) throw new Error("reset_anchor_changed");
      }
      const start = fork ? fork.number + 1 : 0;
      const progress: RelayProgress = {
        ...previous,
        nextBlock: start,
        lastHash: fork?.hash ?? null,
        page: null,
        halted: null,
      };
      const discardedPaidClaims = (await listStoredValues<Withdrawal>(tx, "paid:")).filter(
        (row) => row.blockNumber === undefined || row.blockNumber >= start,
      );
      for (const prefix of ["withdrawal:", "result:", "held:"]) {
        await tx.delete(`queue:${prefix}`);
        await deleteStoredRows(
          tx,
          prefix,
          (value) => obligationBlock(value) === undefined || obligationBlock(value)! >= start,
        );
      }
      await deleteStoredRows(tx, "queue-block:", (value) => Number(value) >= start);
      await deleteStoredRows(tx, "block:", (_value, key) => Number(key.slice(6)) >= start);
      const sequence = ((await tx.get<number>("reset:sequence")) ?? 0) + 1;
      await tx.put(`reset:${sequence}`, {
        row,
        reason: reason.trim(),
        at: Math.floor(Date.now() / 1000),
        previous,
        progress,
        fork,
        discardedPaidClaims,
      });
      await tx.put("reset:sequence", sequence);
      await tx.put("progress", progress);
      await tx.delete("lastTick");
      return progress;
    });
  }
  async held() {
    return [...(await this.storage.list<HeldObligation>({ prefix: "held:", limit: 100 })).values()];
  }
  heldRecovery() {
    return this.queuePage<HeldObligation>("held:");
  }
  private async queuePage<A>(prefix: string): Promise<A[]> {
    const cursor = await this.storage.get<string>(`queue:${prefix}`);
    const page = await this.storage.list<A>({ prefix, limit: 100, ...(cursor ? { startAfter: cursor } : {}) });
    await this.storage.put(`queue:${prefix}`, page.size === 100 ? [...page.keys()].at(-1)! : "");
    return [...page.values()];
  }
  async restoreWithdrawal(withdrawal: Withdrawal) {
    await this.storage.transaction(async (tx) => {
      const key = `held:${withdrawal.transactionHash}`;
      const held = await tx.get<HeldObligation>(key);
      if (held) await tx.delete(obligationIndexKey(key, obligationBlock(held) ?? 0));
      await indexObligation(tx, `withdrawal:${withdrawal.transactionHash}`, withdrawal.blockNumber ?? 0);
      await tx.put(`withdrawal:${withdrawal.transactionHash}`, withdrawal);
      await tx.delete(key);
    });
  }
  async hold(obligation: HeldObligation) {
    await this.storage.transaction(async (tx) => {
      await indexObligation(tx, heldKey(obligation), obligationBlock(obligation) ?? 0);
      await tx.put(heldKey(obligation), obligation);
      if (obligation.kind === "payment") {
        await tx.delete(
          obligationIndexKey(
            `withdrawal:${obligation.withdrawal.transactionHash}`,
            obligation.withdrawal.blockNumber ?? 0,
          ),
        );
        await tx.delete(`withdrawal:${obligation.withdrawal.transactionHash}`);
      }
    });
  }
}

const heldKey = (held: HeldObligation) => {
  if (held.kind === "result") return `held:result:${held.result.gameId}`;
  if (held.kind === "row") return `held:row:${held.row.transactionHash}:${held.row.model}`;
  return `held:${held.kind === "receipt" ? held.receipt.transactionHash : held.withdrawal.transactionHash}`;
};

export async function listStoredValues<A>(
  storage: DurableObjectStorage | DurableObjectTransaction,
  prefix: string,
): Promise<A[]> {
  const values: A[] = [];
  let startAfter: string | undefined;
  do {
    const page = await storage.list<A>({ prefix, limit: 1000, ...(startAfter ? { startAfter } : {}) });
    values.push(...page.values());
    if (page.size < 1000) break;
    startAfter = [...page.keys()].at(-1);
  } while (startAfter);
  return values;
}

const obligationBlock = (value: unknown): number | undefined => {
  const row = value as {
    blockNumber?: number;
    withdrawal?: Withdrawal;
    result?: BlitzResult;
    receipt?: { blockNumber?: number };
    row?: { blockNumber?: number };
  };
  return (
    row.blockNumber ??
    row.withdrawal?.blockNumber ??
    row.result?.blockNumber ??
    row.receipt?.blockNumber ??
    row.row?.blockNumber
  );
};
async function deleteStoredRows(
  storage: DurableObjectStorage | DurableObjectTransaction,
  prefix: string,
  discard: (value: unknown, key: string) => boolean,
) {
  let startAfter: string | undefined;
  do {
    const page = await storage.list({ prefix, limit: 1000, ...(startAfter ? { startAfter } : {}) });
    for (const [key, value] of page) if (discard(value, key)) await storage.delete(key);
    startAfter = page.size === 1000 ? [...page.keys()].at(-1) : undefined;
  } while (startAfter);
}

async function pruneBlockAnchors(storage: DurableObjectStorage | DurableObjectTransaction, progress: RelayProgress) {
  const oldest = [...(await storage.list<number>({ prefix: "queue-block:", limit: 1 })).values()][0];
  const floor = Math.max(
    0,
    Math.min(progress.page ? progress.nextBlock - 1 : progress.nextBlock - 2, (oldest ?? progress.nextBlock) - 1),
  );
  const obsolete = await storage.list({ prefix: "block:", end: blockKey(floor), limit: 100 });
  for (const key of obsolete.keys()) await storage.delete(key);
}
const obligationIndexKey = (key: string, number: number) => `queue-block:${String(number).padStart(16, "0")}:${key}`;
const indexObligation = (storage: DurableObjectTransaction, key: string, number: number) =>
  storage.put(obligationIndexKey(key, number), number);

const blockKey = (number: number) => `block:${String(number).padStart(16, "0")}`;
