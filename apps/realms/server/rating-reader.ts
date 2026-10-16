import { normalizeStarknetAddress as canonicalFelt } from "@realms-world/identity";
import { identityL2Configuration, fetchIdentityRpc } from "./l2";
import type { IdentityEnv } from "./env";
import { DurableObject } from "cloudflare:workers";
import { hash, RpcError, RpcProvider } from "starknet";
import { openRatingLedger, readLedgerRatings, ratingPoints } from "./rating-ledger";
import type { RatingLedger } from "./rating-ledger";

type Env = Pick<IdentityEnv, "ENVIRONMENT" | "L2_RPC_URL">;
const RPC_METHODS_PER_MINUTE = 10000;
const MMR_UPDATED = hash.getSelectorFromName("MMRUpdated");
const SCAN_BLOCKS = 100_000;
const EVENTS_PER_PAGE = 1000;
const CONTRACT_NOT_FOUND = 20;

/**
 * One RPC budget across callers; every read names a verified chain block and retains no rating value. The top list's
 * population is every wallet the token has ever updated, read from its own events and kept with the block (height and
 * hash) they were read through. A kept block the chain no longer holds discards the population, which is read again,
 * so a wallet seen only in a replaced block cannot stay ranked. A range extends the population only if the chain still
 * holds that block once the range is read, so a range from a newer branch is never added to an older branch's wallets.
 */
export class RatingReader extends DurableObject<Env> {
  private tail: Promise<unknown> = Promise.resolve();
  private provider: RpcProvider;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    identityL2Configuration(env);
    ctx.storage.sql.exec("DROP TABLE IF EXISTS snapshots");
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS rated_players (token TEXT NOT NULL, player TEXT NOT NULL, PRIMARY KEY (token, player))",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS rated_checkpoint (token TEXT PRIMARY KEY, block INTEGER NOT NULL, hash TEXT NOT NULL)",
    );
    this.provider = new RpcProvider({
      nodeUrl: env.L2_RPC_URL,
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
      const ledger = await openRatingLedger(this.provider, this.env);
      const values = await readLedgerRatings(ledger, await this.ratedPlayers(ledger));
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
  private async ratedPlayers(ledger: RatingLedger) {
    const token = ledger.ratingToken;
    let kept = await this.canonicalCheckpoint(ledger);
    if (kept === undefined) {
      this.forgetPopulation(token);
      kept = { block: (await this.deployBlock(ledger)) - 1 };
    }
    while (kept.block < ledger.block) {
      const last = Math.min(kept.block + SCAN_BLOCKS, ledger.block);
      const lastHash = await this.blockHash(last);
      if (last === ledger.block && lastHash !== ledger.blockHash) throw new Error("Rating block replaced during scan");
      const players = await this.updatedPlayers(token, kept.block + 1, last);
      if ((await this.blockHash(last)) !== lastHash) throw new Error("Rating events changed branch during scan");
      if (kept.hash !== undefined && (await this.blockHash(kept.block)) !== kept.hash) {
        this.forgetPopulation(token);
        throw new Error("Rating population's block replaced during scan");
      }
      for (const player of players)
        this.ctx.storage.sql.exec("INSERT OR IGNORE INTO rated_players VALUES (?, ?)", token, player);
      this.ctx.storage.sql.exec("INSERT OR REPLACE INTO rated_checkpoint VALUES (?, ?, ?)", token, last, lastHash);
      kept = { block: last, hash: lastHash };
    }
    return this.ctx.storage.sql
      .exec<{ player: string }>("SELECT player FROM rated_players WHERE token = ?", token)
      .toArray()
      .map(({ player }) => player);
  }
  /**
   * The kept block, if the chain still holds that exact block. A kept block above the ledger's is not judged: the
   * provider may merely lag, so the request is refused until the chain passes that height and its hash decides.
   */
  private async canonicalCheckpoint(ledger: RatingLedger): Promise<{ block: number; hash?: string } | undefined> {
    const [kept] = this.ctx.storage.sql
      .exec<{
        block: number;
        hash: string;
      }>("SELECT block, hash FROM rated_checkpoint WHERE token = ?", ledger.ratingToken)
      .toArray();
    if (!kept) return undefined;
    if (kept.block > ledger.block) throw new Error("Rating population is ahead of the chain's head");
    const hash = kept.block === ledger.block ? ledger.blockHash : await this.blockHash(kept.block);
    return hash === kept.hash ? { block: kept.block, hash } : undefined;
  }
  private forgetPopulation(token: string) {
    this.ctx.storage.sql.exec("DELETE FROM rated_players WHERE token = ?", token);
    this.ctx.storage.sql.exec("DELETE FROM rated_checkpoint WHERE token = ?", token);
  }
  private async blockHash(block: number) {
    const header = await this.provider.getBlock(block);
    if (!("block_hash" in header) || typeof header.block_hash !== "string") throw new Error("Rating block unconfirmed");
    return canonicalFelt(header.block_hash);
  }
  private async updatedPlayers(token: string, first: number, last: number) {
    const players = new Set<string>();
    let continuation: string | undefined;
    do {
      const page = await this.provider.getEvents({
        address: token,
        keys: [[MMR_UPDATED]],
        from_block: { block_number: first },
        to_block: { block_number: last },
        chunk_size: EVENTS_PER_PAGE,
        ...(continuation ? { continuation_token: continuation } : {}),
      });
      for (const { keys } of page.events) {
        if (keys[1] === undefined) throw new Error("Rating update names no player");
        players.add(canonicalFelt(keys[1]));
      }
      continuation = page.continuation_token;
    } while (continuation);
    return players;
  }
  /** The first block holding the token's class, so a new reader never scans the chain from genesis. */
  private async deployBlock(ledger: RatingLedger) {
    let low = 0;
    let high = ledger.block;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (await this.deployedAt(ledger.ratingToken, middle)) high = middle;
      else low = middle + 1;
    }
    return low;
  }
  private async deployedAt(token: string, block: number) {
    try {
      await this.provider.getClassHashAt(token, block);
      return true;
    } catch (error) {
      if (error instanceof RpcError && error.code === CONTRACT_NOT_FOUND) return false;
      throw error;
    }
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
