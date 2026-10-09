import { hash } from "starknet";
import { rpcAt, ledgerInteger } from "@realms-world/value-ledger";
import { ShardReader, sameFelt, uint } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow } from "./shard-snapshot";
import { relayOperation } from "./ports";

interface GameFunding {
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
}
interface Discovery {
  game: Omit<GameFunding, "seasonId">;
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
      if (cached) {
        if (cached.gameId !== gameId || BigInt(cached.chainId) !== BigInt(reader.connection.chainId))
          throw new Error("funding_binding_key_differs");
        requireTimelyReceipt(confirmedAt, cached.deadline);
        return cached.seasonId;
      }
      const scanKey = `discover:${key}`;
      const discovery = (await storage.get<Discovery>(scanKey)) ?? {
        game: await readGameFunding(reader, heraldUrl, gameId),
        head: await rpcAt(ledger.rpcUrl).getBlockNumber(),
        seen: [],
        matches: [],
      };
      requireTimelyReceipt(confirmedAt, discovery.game.deadline);
      const page = await readFundingPage(reader, ledger, discovery);
      if (page.token) {
        await storage.put(scanKey, page);
        throw new Error("frontier_funding_discovery_pending");
      }
      if (page.matches.length !== 1) {
        // A season not yet funded can appear at a later head. Preserve the game's facts, restart only ledger discovery.
        await storage.put(scanKey, {
          ...page,
          head: await rpcAt(ledger.rpcUrl).getBlockNumber(),
          seen: [],
          matches: [],
        });
        throw new Error("frontier_funding_missing_or_ambiguous");
      }
      const binding = { ...page.game, seasonId: page.matches[0]! };
      await storage.put(key, binding);
      return binding.seasonId;
    }),
});

const readGameFunding = async (
  reader: ShardReader,
  heraldUrl: string,
  gameId: number,
): Promise<Omit<GameFunding, "seasonId">> => {
  const shardHead = await reader.head();
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
  const snapshot = await readConfirmedSnapshot(reader.connection, heraldUrl, gameId, ["SliceRules", "ChestRules"]);
  const rules = singleRow(snapshot, "SliceRules"),
    chests = singleRow(snapshot, "ChestRules");
  const unit = uint(String(rules.day_unit_seconds), 32),
    window = uint(String(chests.claim_window_seconds), 32),
    pool = uint(String(chests.pool), 128) * 10n ** 18n;
  if (!unit || !window || end <= start || (end - start) % (20n * unit) !== 0n)
    throw new Error("invalid_shard_frontier_calendar");
  return {
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
  game: Omit<GameFunding, "seasonId">,
  seasonId: number,
  head: number,
) => {
  const funded = await provider.callContract(
    { contractAddress: ledger.address, entrypoint: "get_frontier", calldata: [game.chainId, String(seasonId)] },
    head,
  );
  if (funded.length !== 10 || uint(funded[0]!, 1) !== 1n) throw new Error("frontier_season_abi_differs");
  if (
    uint(funded[1]!, 64) !== BigInt(game.start) ||
    uint(funded[2]!, 64) !== BigInt(game.end) ||
    uint(funded[9]!, 252) !== BigInt(game.seed)
  )
    return false;
  const preset = await provider.callContract(
    { contractAddress: ledger.address, entrypoint: "get_preset", calldata: [funded[8]!] },
    head,
  );
  if (
    preset.length !== 21 ||
    uint(preset[17]!, 32) !== BigInt(game.unit) ||
    uint(preset[18]!, 32) !== BigInt(game.bags) ||
    uint(preset[19]!, 32) !== BigInt(game.window) ||
    uint(funded[3]!, 128) + (uint(funded[4]!, 128) << 128n) !== BigInt(game.pool)
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
