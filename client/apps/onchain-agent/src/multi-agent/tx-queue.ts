// Serializes on-chain writes — both agents share one Cartridge session,
// concurrent writes cause nonce collisions.

interface QueueItem {
  agent: string;
  label: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: unknown) => void;
  enqueuedAt: number;
}

export class TxQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private _stats = { total: 0, success: 0, failed: 0, totalWaitMs: 0 };

  async enqueue<T>(agent: string, label: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ agent, label, fn, resolve, reject, enqueuedAt: Date.now() });
      this.process();
    });
  }

  get stats() {
    return { ...this._stats, pending: this.queue.length };
  }

  get pending(): number {
    return this.queue.length;
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      const waitMs = Date.now() - item.enqueuedAt;
      this._stats.total++;
      this._stats.totalWaitMs += waitMs;

      try {
        const result = await item.fn();
        this._stats.success++;
        item.resolve(result);
      } catch (err) {
        this._stats.failed++;
        item.reject(err);
      }
    }

    this.processing = false;
  }
}
