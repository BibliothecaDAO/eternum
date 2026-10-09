import { DurableObject } from "cloudflare:workers";
import { RpcProvider } from "starknet";
import { openRatingLedger, readLedgerRatings, ratingPoints } from "./rating-ledger";

interface Snapshot {
  block_number: number;
  block_hash: string;
  values: Record<string, string>;
  entries: { player: string; rating: string; rank: number }[] | null;
}
interface Env {
  IDENTITY_RPC_URL: string;
}
const HISTORY_URL = "https://realms.world/api/ratings/population";
const RPC_METHODS_PER_MINUTE = 10000;

/** One cache and budget across callers and isolates. Every cached value belongs to a verified immutable block hash. */
export class RatingReader extends DurableObject<Env> {
  private tail: Promise<unknown> = Promise.resolve();
  private provider: RpcProvider;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS snapshots (hash TEXT PRIMARY KEY, data TEXT NOT NULL, used INTEGER NOT NULL)",
    );
    this.provider = new RpcProvider({
      nodeUrl: env.IDENTITY_RPC_URL,
      specVersion: "0.9.0",
      batch: 10,
      baseFetch: (input: RequestInfo | URL, init?: RequestInit) => this.paidFetch(input, init),
    });
  }

  ratings(owners: string[], blockHash?: string) {
    return this.serial(async () => {
      const snapshot = blockHash ? this.cached(blockHash) : await this.latest();
      if (!snapshot) throw new Error("Rating snapshot unavailable");
      await this.completeValues(snapshot, owners);
      return {
        block_number: snapshot.block_number,
        block_hash: snapshot.block_hash,
        values: owners.map((owner) => [owner, this.requiredValue(snapshot, owner)] as [string, string]),
      };
    });
  }

  top() {
    return this.serial(async () => {
      const head = await this.historyHead();
      const ready = this.cached(head.block_hash);
      if (ready && ready.block_number !== head.block_number) throw new Error("Rating history watermark inconsistent");
      if (ready?.entries)
        return { block_number: ready.block_number, block_hash: ready.block_hash, entries: ready.entries };
      const history = await this.history();
      let snapshot = this.cached(history.block_hash);
      if (!snapshot) {
        const ledger = await openRatingLedger(this.provider, history.block_hash);
        if (ledger.block !== history.block_number) throw new Error("History checkpoint does not match chain");
        snapshot = this.newSnapshot(ledger.block, ledger.blockHash);
      }
      if (!snapshot.entries) {
        await this.completeValues(snapshot, history.players);
        snapshot.entries = this.rank(snapshot, history.players);
        this.save(snapshot);
      }
      return { block_number: snapshot.block_number, block_hash: snapshot.block_hash, entries: snapshot.entries };
    });
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private cached(hash: string): Snapshot | null {
    const row = this.ctx.storage.sql
      .exec<{ data: string }>("SELECT data FROM snapshots WHERE hash = ?", `0x${BigInt(hash).toString(16)}`)
      .toArray()[0];
    return row ? (JSON.parse(row.data) as Snapshot) : null;
  }
  private async latest() {
    const ledger = await openRatingLedger(this.provider);
    return this.cached(ledger.blockHash) ?? this.newSnapshot(ledger.block, ledger.blockHash);
  }
  private newSnapshot(block: number, hash: string): Snapshot {
    return { block_number: block, block_hash: hash, values: {}, entries: null };
  }
  private save(snapshot: Snapshot) {
    this.ctx.storage.sql.exec(
      "INSERT INTO snapshots (hash,data,used) VALUES (?,?,?) ON CONFLICT(hash) DO UPDATE SET data=excluded.data, used=excluded.used",
      snapshot.block_hash,
      JSON.stringify(snapshot),
      Date.now(),
    );
    // Keep 32 recent named snapshots, not an unbounded per-height cache.
    this.ctx.storage.sql.exec(
      "DELETE FROM snapshots WHERE hash NOT IN (SELECT hash FROM snapshots ORDER BY used DESC LIMIT 32)",
    );
  }
  private async completeValues(snapshot: Snapshot, owners: string[]) {
    const missing = [...new Set(owners)].filter((owner) => snapshot.values[owner] === undefined);
    if (!missing.length) return;
    const ledger = {
      provider: this.provider,
      signal: AbortSignal.timeout(10000),
      block: snapshot.block_number,
      blockHash: snapshot.block_hash,
    };
    const values = await readLedgerRatings(ledger, missing);
    for (const [owner, value] of values) snapshot.values[owner] = value.toString();
    this.save(snapshot);
  }
  private requiredValue(snapshot: Snapshot, owner: string) {
    const value = snapshot.values[owner];
    if (value === undefined) throw new Error("Rating snapshot value missing");
    return value;
  }
  private rank(snapshot: Snapshot, owners: string[]) {
    const ordered = [...new Set(owners)].sort((a, b) => {
      const left = BigInt(this.requiredValue(snapshot, a)),
        right = BigInt(this.requiredValue(snapshot, b));
      if (left !== right) return left > right ? -1 : 1;
      return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
    });
    let rank = 0;
    return ordered.map((player, index) => {
      const value = BigInt(this.requiredValue(snapshot, player));
      if (!index || value !== BigInt(this.requiredValue(snapshot, ordered[index - 1]!))) rank = index + 1;
      return { player, rank, rating: ratingPoints(value) };
    });
  }
  private async historyHead() {
    const response = await fetch(HISTORY_URL, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });
    const hash = response.headers.get("x-rating-hash");
    const number = response.headers.get("x-rating-block");
    if (
      !response.ok ||
      number === null ||
      !/^(0|[1-9][0-9]*)$/.test(number) ||
      !Number.isSafeInteger(Number(number)) ||
      Number(number) < 0 ||
      !hash ||
      !/^0x[0-9a-fA-F]{1,64}$/.test(hash) ||
      BigInt(hash) <= 0n
    )
      throw new Error("Rating history unavailable");
    return { block_number: Number(number), block_hash: `0x${BigInt(hash).toString(16)}` };
  }
  private async history() {
    const response = await fetch(HISTORY_URL, {
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) throw new Error("Rating history unavailable");
    const data = (await response.json()) as { block_number?: unknown; block_hash?: unknown; players?: unknown };
    if (
      !Number.isSafeInteger(data.block_number) ||
      Number(data.block_number) < 0 ||
      typeof data.block_hash !== "string" ||
      !/^0x[0-9a-fA-F]{1,64}$/.test(data.block_hash) ||
      BigInt(data.block_hash) <= 0n ||
      !Array.isArray(data.players) ||
      !data.players.every(
        (player) =>
          typeof player === "string" &&
          /^0x[0-9a-fA-F]{1,64}$/.test(player) &&
          BigInt(player) > 0n &&
          BigInt(player) < (1n << 251n) - 256n,
      )
    )
      throw new Error("Invalid rating history checkpoint");
    return {
      block_number: Number(data.block_number),
      block_hash: `0x${BigInt(data.block_hash).toString(16)}`,
      players: [...new Set(data.players.map((player) => `0x${BigInt(player).toString(16)}`))],
    };
  }
  private async paidFetch(input: RequestInfo | URL, init?: RequestInit) {
    const payload = JSON.parse(String(init?.body));
    const cost = Array.isArray(payload) ? payload.length : 1;
    const minute = Math.floor(Date.now() / 60000);
    const saved = await this.ctx.storage.get<{ minute: number; used: number }>("rpc-budget");
    const used = saved?.minute === minute ? saved.used : 0;
    if (used + cost > RPC_METHODS_PER_MINUTE) throw new Error("Rating RPC budget exhausted");
    await this.ctx.storage.put("rpc-budget", { minute, used: used + cost });
    return fetch(input, { ...init, signal: AbortSignal.timeout(10000) });
  }
}
