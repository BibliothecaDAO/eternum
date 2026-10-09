import type { BlitzResult, ConfirmedBlock, Withdrawal } from "./ports";

export interface RelayProgress {
  nextBlock: number;
  lastHash: string | null;
  halted: string | null;
}
export interface RelayStore {
  progress(): Promise<RelayProgress>;
  observe(block: ConfirmedBlock): Promise<void>;
  withdrawals(): Promise<readonly Withdrawal[]>;
  results(): Promise<readonly BlitzResult[]>;
  completeWithdrawal(transactionHash: string): Promise<void>;
  completeResult(gameId: number): Promise<void>;
  halt(reason: string): Promise<void>;
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
      await tx.put("progress", { nextBlock: block.number + 1, lastHash: block.hash, halted: null });
    });
  }
  async withdrawals() {
    return await this.listPending<Withdrawal>("withdrawal:");
  }
  async results() {
    return await this.listPending<BlitzResult>("result:");
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
  private async listPending<A>(prefix: string): Promise<A[]> {
    const values: A[] = [];
    let startAfter: string | undefined;
    do {
      const page = await this.storage.list<A>({ prefix, limit: 1000, ...(startAfter ? { startAfter } : {}) });
      values.push(...page.values());
      if (page.size < 1000) break;
      startAfter = [...page.keys()].at(-1);
    } while (startAfter);
    return values;
  }
}
