import type { BlitzResult, ConfirmedBlock, Withdrawal, HeldObligation } from "./ports";

export interface RelayProgress {
  nextBlock: number;
  lastHash: string | null;
  halted: string | null;
  page?: { head: number; hash: string; token: string } | null;
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
    await this.storage.transaction(async (tx) => {
      for (const withdrawal of block.withdrawals) await tx.put(`withdrawal:${withdrawal.transactionHash}`, withdrawal);
      for (const result of block.results) await tx.put(`result:${result.gameId}`, result);
      for (const held of block.held ?? []) await tx.put(heldKey(held), held);
      const previous = (await tx.get<RelayProgress>("progress")) ?? { nextBlock: 0, lastHash: null, halted: null };
      await tx.put("progress", {
        ...previous,
        nextBlock: block.next ? block.fromBlock! : block.number + 1,
        lastHash: block.next ? previous.lastHash : block.hash,
        page: block.next ? { head: block.number, hash: block.hash, token: block.next } : null,
        halted: null,
      });
    });
  }
  async withdrawals() {
    return this.queuePage<Withdrawal>("withdrawal:");
  }
  async results() {
    return this.queuePage<BlitzResult>("result:");
  }
  async completeWithdrawal(transactionHash: string) {
    await this.storage.delete(`withdrawal:${transactionHash}`);
  }
  async completeResult(gameId: number) {
    await this.storage.delete(`result:${gameId}`);
  }
  async halt(reason: string) {
    await this.storage.put("progress", { ...(await this.progress()), halted: reason });
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
      await tx.put(`withdrawal:${withdrawal.transactionHash}`, withdrawal);
      await tx.delete(`held:${withdrawal.transactionHash}`);
    });
  }
  async hold(obligation: HeldObligation) {
    await this.storage.transaction(async (tx) => {
      await tx.put(heldKey(obligation), obligation);
      if (obligation.kind === "payment") await tx.delete(`withdrawal:${obligation.withdrawal.transactionHash}`);
    });
  }
}

const heldKey = (held: HeldObligation) =>
  `held:${held.kind === "receipt" ? held.receipt.transactionHash : held.withdrawal.transactionHash}`;

export async function listStoredValues<A>(storage: DurableObjectStorage, prefix: string): Promise<A[]> {
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
