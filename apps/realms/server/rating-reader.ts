import { normalizeStarknetAddress as canonicalFelt } from "@realms-world/identity";
import { identityL2Configuration, fetchIdentityRpc } from "./l2";
import type { IdentityEnv } from "./env";
import { DurableObject } from "cloudflare:workers";
import { RpcProvider } from "starknet";
import { openRatingLedger, readLedgerRatings, ratingPoints } from "./rating-ledger";

type Env = Pick<IdentityEnv, "ENVIRONMENT" | "IDENTITY_RPC_URL" | "RATING_TOKEN_ADDRESS" | "RATING_HISTORY_URL">;
const RPC_METHODS_PER_MINUTE = 10000;

/** One RPC budget across callers; every read names a verified chain block and retains no rating state. */
export class RatingReader extends DurableObject<Env> {
  private tail: Promise<unknown> = Promise.resolve();
  private provider: RpcProvider;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    identityL2Configuration(env);
    ctx.storage.sql.exec("DROP TABLE IF EXISTS snapshots");
    this.provider = new RpcProvider({
      nodeUrl: env.IDENTITY_RPC_URL,
      specVersion: "0.9.0",
      batch: 10,
      baseFetch: (input: RequestInfo | URL, init?: RequestInit) => this.paidFetch(input, init),
    });
  }

  ratings(owners: string[], blockHash?: string) {
    return this.serial(async () => {
      const ledger = await openRatingLedger(this.provider, this.env, blockHash);
      const values = await readLedgerRatings(ledger, owners);
      return {
        block_number: ledger.block,
        block_hash: ledger.blockHash,
        values: [...values].map(([owner, value]) => [owner, value.toString()] as [string, string]),
      };
    });
  }

  top() {
    return this.serial(async () => {
      const history = await this.history();
      const ledger = await openRatingLedger(this.provider, this.env, history.block_hash);
      if (ledger.block !== history.block_number) throw new Error("History checkpoint does not match chain");
      const values = await readLedgerRatings(ledger, history.players);
      return { block_number: ledger.block, block_hash: ledger.blockHash, entries: this.rank(values) };
    });
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private rank(values: Map<string, bigint>) {
    const ordered = [...values].sort(([leftOwner, left], [rightOwner, right]) =>
      left !== right ? (left > right ? -1 : 1) : BigInt(leftOwner) < BigInt(rightOwner) ? -1 : 1,
    );
    let rank = 0;
    return ordered.map(([player, value], index) => {
      if (!index || value !== ordered[index - 1]![1]) rank = index + 1;
      return { player, rank, rating: ratingPoints(value) };
    });
  }
  private async history() {
    const response = await fetch(this.env.RATING_HISTORY_URL, {
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
      players: [...new Set(data.players.map((player) => canonicalFelt(player)))],
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
    return fetchIdentityRpc(input, { ...init, signal: AbortSignal.timeout(10000) });
  }
}
