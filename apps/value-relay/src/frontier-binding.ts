import { cacheAnchorMatches, type CacheAnchor } from "./cache-anchor";
import { hash } from "starknet";
import {
  rpcAt,
  ledgerInteger,
  readConfirmedLedgerHead,
  decodeFrontierSeason,
  decodeLedgerPreset,
} from "@realms-world/value-ledger";
import { ShardReader, sameFelt, uint } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow } from "./shard-snapshot";
import { relayOperation } from "./ports";

interface GameFunding {
  shardAnchor: CacheAnchor;
  ledgerAnchor: CacheAnchor;
  chainId: string;
  gameId: number;
  seasonId: number;
  start: string;
  end: string;
  seed: string;
  unit: string;
  bags: string;
  pool: string;
  window: string;
  deadline: string;
}
interface FundingStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}
interface Discovery {
  game: Omit<GameFunding, "seasonId" | "ledgerAnchor">;
  ledgerAnchor: CacheAnchor;
  head: number;
  token?: string | undefined;
  seen: string[];
  matches: number[];
}
type Ledger = { rpcUrl: string; address: string };

/** Immutable game bindings and their first discovery both survive Worker recreation. */
export const frontierReceiptBindings = (
  reader: ShardReader,
  ledger: Ledger,
  identity: { realmsIdForAccount(account: string): Promise<string | null> },
  heraldUrl: string,
  storage: FundingStore,
) => ({
  realmsIdForAccount: (account: string) => identity.realmsIdForAccount(account),
  frontierSeason: (gameId: number, confirmedAt: number) =>
    relayOperation("resolve_frontier_funding", async () => {
      const key = `funding:${BigInt(reader.connection.chainId).toString(16)}:${gameId}`;
      const cached = await storage.get<GameFunding>(key);
      const shardValid = (anchor: CacheAnchor | undefined) =>
        cacheAnchorMatches(anchor, async (number) => (await reader.header(number)).block_hash);
      const ledgerValid = (anchor: CacheAnchor | undefined) =>
        cacheAnchorMatches(
          anchor,
          async (number) => (await readConfirmedLedgerHead(rpcAt(ledger.rpcUrl), number)).hash,
        );
      if (cached) {
        if (cached.gameId !== gameId || BigInt(cached.chainId) !== BigInt(reader.connection.chainId))
          throw new Error("funding_binding_key_differs");
        if ((await shardValid(cached.shardAnchor)) && (await ledgerValid(cached.ledgerAnchor))) {
          requireTimelyReceipt(confirmedAt, cached.deadline);
          return cached.seasonId;
        }
        await storage.delete(key);
      }
      const scanKey = `discover:${key}`;
      let discovery = await storage.get<Discovery>(scanKey);
      if (
        discovery &&
        (!(await shardValid(discovery.game.shardAnchor)) || !(await ledgerValid(discovery.ledgerAnchor)))
      ) {
        await storage.delete(scanKey);
        discovery = undefined;
      }
      if (!discovery) {
        const head = await readConfirmedLedgerHead(rpcAt(ledger.rpcUrl));
        discovery = {
          game: await readGameFunding(reader, heraldUrl, gameId),
          head: head.number,
          ledgerAnchor: { number: head.number, hash: head.hash },
          seen: [],
          matches: [],
        };
      }
      requireTimelyReceipt(confirmedAt, discovery.game.deadline);
      const page = await readFundingPage(reader, ledger, discovery);
      if (page.token) {
        await storage.put(scanKey, page);
        throw new Error("frontier_funding_discovery_pending");
      }
      if (page.matches.length !== 1) {
        // Keep the shard facts, but scan again through the new confirmed funding head.
        const nextHead = await readConfirmedLedgerHead(rpcAt(ledger.rpcUrl));
        await storage.put(scanKey, {
          ...page,
          head: nextHead.number,
          ledgerAnchor: { number: nextHead.number, hash: nextHead.hash },
          seen: [],
          matches: [],
        });
        throw new Error("frontier_funding_missing_or_ambiguous");
      }
      const binding = { ...page.game, ledgerAnchor: page.ledgerAnchor, seasonId: page.matches[0]! };
      await storage.put(key, binding);
      await storage.delete(scanKey);
      return binding.seasonId;
    }),
});

const readGameFunding = async (
  reader: ShardReader,
  heraldUrl: string,
  gameId: number,
): Promise<Omit<GameFunding, "seasonId" | "ledgerAnchor">> => {
  const snapshot = await readConfirmedSnapshot(reader.connection, heraldUrl, gameId, ["SliceRules", "ChestRules"]);
  const source = await reader.header(snapshot.confirmed_block);
  const shardHead = source.block_number;
  const game = await reader
    .provider()
    .callContract(
      { contractAddress: reader.connection.gamesAddress, entrypoint: "game", calldata: [String(gameId)] },
      shardHead,
    );
  if (game.length !== 10) throw new Error("game_registry_abi_differs");
  const start = uint(game[6]!, 64),
    end = uint(game[7]!, 64),
    seed = uint(game[9]!, 252);
  const rules = singleRow(snapshot, "SliceRules"),
    chests = singleRow(snapshot, "ChestRules");
  const unit = uint(String(rules.day_unit_seconds), 32),
    window = uint(String(chests.claim_window_seconds), 32),
    pool = uint(String(chests.pool), 128) * 10n ** 18n;
  if (!unit || !window || end <= start || (end - start) % (20n * unit) !== 0n)
    throw new Error("invalid_shard_frontier_calendar");
  return {
    shardAnchor: { number: source.block_number, hash: source.block_hash },
    chainId: reader.connection.chainId,
    gameId,
    start: String(start),
    end: String(end),
    seed: String(seed),
    unit: String(unit),
    bags: String((end - start) / (20n * unit)),
    pool: String(pool),
    window: String(window),
    deadline: String(end + window),
  };
};

/** One funding page per attempt; no receipt scans the complete season history in one tick. */
const readFundingPage = async (reader: ShardReader, ledger: Ledger, scan: Discovery): Promise<Discovery> => {
  const provider = rpcAt(ledger.rpcUrl);
  const page = await provider.getEvents({
    address: ledger.address,
    from_block: { block_number: 0 },
    to_block: { block_number: scan.head },
    keys: [[hash.getSelectorFromName("FrontierFunded")], [reader.connection.chainId]],
    chunk_size: 100,
    ...(scan.token ? { continuation_token: scan.token } : {}),
  });
  if (page.events.length > 100) throw new Error("frontier_funding_page_too_large");
  const matches = [...scan.matches];
  for (const event of page.events) {
    if (
      !sameFelt(event.from_address, ledger.address) ||
      event.keys.length !== 3 ||
      event.data.length !== 4 ||
      !sameFelt(event.keys[1]!, reader.connection.chainId)
    )
      throw new Error("invalid_frontier_funding_event");
    if (uint(event.data[0]!, 64) !== BigInt(scan.game.start) || uint(event.data[1]!, 64) !== BigInt(scan.game.end))
      continue;
    const seasonId = ledgerInteger(event.keys[2]!);
    if ((await matchesGameFunding(provider, ledger, scan.game, seasonId, scan.head)) && !matches.includes(seasonId))
      matches.push(seasonId);
  }
  const token = page.continuation_token;
  if (token && scan.seen.includes(token)) throw new Error("frontier_funding_page_cycle");
  return { ...scan, matches, token, seen: token ? [...scan.seen, token] : scan.seen };
};
const matchesGameFunding = async (
  provider: ReturnType<typeof rpcAt>,
  ledger: Ledger,
  game: Omit<GameFunding, "seasonId" | "ledgerAnchor">,
  seasonId: number,
  head: number,
) => {
  const funded = await provider.callContract(
    { contractAddress: ledger.address, entrypoint: "get_frontier", calldata: [game.chainId, String(seasonId)] },
    head,
  );
  const season = decodeFrontierSeason(funded);
  if (!season.configured) throw new Error("frontier_season_abi_differs");
  if (
    BigInt(season.start) !== BigInt(game.start) ||
    BigInt(season.end) !== BigInt(game.end) ||
    BigInt(season.seed) !== BigInt(game.seed)
  )
    return false;
  const preset = await provider.callContract(
    { contractAddress: ledger.address, entrypoint: "get_preset", calldata: [String(season.presetId)] },
    head,
  );
  const rules = decodeLedgerPreset(preset);
  if (
    BigInt(rules.dayUnit) !== BigInt(game.unit) ||
    BigInt(rules.bags) !== BigInt(game.bags) ||
    BigInt(rules.claimWindow) !== BigInt(game.window) ||
    BigInt(season.pool) !== BigInt(game.pool)
  )
    throw new Error("funded_frontier_preset_differs_from_shard");
  const deadline = await provider.callContract(
    {
      contractAddress: ledger.address,
      entrypoint: "frontier_claim_deadline",
      calldata: [game.chainId, String(seasonId)],
    },
    head,
  );
  if (deadline.length !== 1 || uint(deadline[0]!, 64) !== BigInt(game.deadline))
    throw new Error("frontier_claim_deadline_differs");
  return true;
};
const requireTimelyReceipt = (confirmedAt: number, deadline: string) => {
  if (!Number.isSafeInteger(confirmedAt) || confirmedAt < 0 || BigInt(confirmedAt) >= BigInt(deadline))
    throw new Error("withdrawal_created_outside_claim_window");
};
