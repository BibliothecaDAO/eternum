import type { Invoke } from "./transaction";

interface Proof {
  seed: string;
  proof: string[];
}

/** Transient RPC work only: no tickets, account nonces or durable queue. */
export class ProverPool {
  private workers: Worker[] = [];
  private next = 0;
  private id = 0;
  private pending = new Map<number, { resolve: (proof: Proof) => void; reject: (error: Error) => void }>();
  readonly ready: Promise<string[]>;

  constructor(keyFile: string, threads: 1 | 2 | 4 | 8, libraryPath?: string) {
    this.ready = Promise.all(
      Array.from({ length: threads }, () => {
        const worker = new Worker(new URL("./proof-worker.ts", import.meta.url).href);
        this.workers.push(worker);
        return new Promise<string[]>((resolve, reject) => {
          worker.onmessage = (event) => {
            const result = event.data;
            if (result.kind === "ready") {
              resolve(result.publicKey);
              return;
            }
            if (result.id === undefined) {
              reject(new Error(result.error));
              return;
            }
            const job = this.pending.get(result.id);
            if (!job) return;
            this.pending.delete(result.id);
            if (result.kind === "error") job.reject(new Error(result.error));
            else job.resolve({ seed: result.seed, proof: result.proof });
          };
          worker.onerror = () => {
            const error = new Error("VRF worker stopped");
            reject(error);
            this.stop(error);
          };
          worker.postMessage({ kind: "initialize", keyFile, libraryPath });
        });
      }),
    )
      .then((keys) => {
        if (keys.some((key) => key.join() !== keys[0].join())) throw new Error("VRF workers disagree on public key");
        return keys[0];
      })
      .catch((error) => {
        this.stop(error instanceof Error ? error : new Error("VRF pool initialization failed"));
        throw error;
      });
  }

  async stamp(tx: Invoke, chain: string): Promise<Invoke> {
    await this.ready;
    if (!this.workers.length) throw new Error("VRF pool is closed");
    if (this.pending.size >= 4096) throw new Error("VRF spike RPC work limit exceeded");
    const id = this.id++;
    const work = new Promise<Proof>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    const raw = new TextEncoder().encode(JSON.stringify(tx)).buffer;
    this.workers[this.next++ % this.workers.length].postMessage({ id, raw, chain }, [raw]);
    const { proof } = await work;
    return { ...tx, signature: [...tx.signature, ...proof] };
  }

  stop(error = new Error("VRF pool closed")): void {
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
  }
}
