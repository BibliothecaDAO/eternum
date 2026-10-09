import { hash } from "starknet";
import { rpcAt, ledgerInteger } from "@realms-world/value-ledger";
import { ShardReader, sameFelt, uint } from "./shard-rpc";
import { readConfirmedSnapshot, singleRow } from "./shard-snapshot";
import { relayOperation } from "./ports";

/** Funding binds immutable start/end/seed, not a guessed game id or the directory's display ordinal. */
export const frontierReceiptBindings = (
  reader: ShardReader,
  ledger: { rpcUrl: string; address: string },
  identity: { realmsIdForAccount(account: string): Promise<string | null> },
  heraldUrl: string,
) => ({
  realmsIdForAccount: (account: string) => identity.realmsIdForAccount(account),
  frontierSeason: (gameId: number, confirmedAt: number) =>
    relayOperation("resolve_frontier_funding", async () => {
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
      const nativeRules = singleRow(snapshot, "SliceRules");
      const nativeChests = singleRow(snapshot, "ChestRules");
      const unit = uint(String(nativeRules.day_unit_seconds), 32);
      const window = uint(String(nativeChests.claim_window_seconds), 32);
      const pool = uint(String(nativeChests.pool), 128) * 10n ** 18n;
      if (!unit || !window || (end - start) % (20n * unit) !== 0n) throw new Error("invalid_shard_frontier_calendar");
      const provider = rpcAt(ledger.rpcUrl);
      const head = await provider.getBlockNumber();
      const matches: number[] = [];
      let token: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await provider.getEvents({
          address: ledger.address,
          from_block: { block_number: 0 },
          to_block: { block_number: head },
          keys: [[hash.getSelectorFromName("FrontierFunded")], [reader.connection.chainId]],
          chunk_size: 100,
          ...(token ? { continuation_token: token } : {}),
        });
        for (const event of page.events) {
          if (
            !sameFelt(event.from_address, ledger.address) ||
            event.keys.length !== 3 ||
            event.data.length !== 4 ||
            !sameFelt(event.keys[1]!, reader.connection.chainId)
          )
            throw new Error("invalid_frontier_funding_event");
          const seasonId = ledgerInteger(event.keys[2]!);
          const funded = await provider.callContract(
            {
              contractAddress: ledger.address,
              entrypoint: "get_frontier",
              calldata: [reader.connection.chainId, String(seasonId)],
            },
            head,
          );
          if (funded.length !== 10 || uint(funded[0]!, 1) !== 1n) throw new Error("frontier_season_abi_differs");
          if (uint(funded[1]!, 64) !== start || uint(funded[2]!, 64) !== end || uint(funded[9]!, 252) !== seed)
            continue;
          const preset = await provider.callContract(
            { contractAddress: ledger.address, entrypoint: "get_preset", calldata: [funded[8]!] },
            head,
          );
          if (
            preset.length !== 20 ||
            uint(preset[17]!, 32) !== unit ||
            uint(preset[18]!, 32) !== (end - start) / (20n * unit) ||
            uint(preset[19]!, 32) !== window ||
            uint(funded[3]!, 128) + (uint(funded[4]!, 128) << 128n) !== pool
          )
            throw new Error("funded_frontier_preset_differs_from_shard");
          const deadline = await provider.callContract(
            {
              contractAddress: ledger.address,
              entrypoint: "frontier_claim_deadline",
              calldata: [reader.connection.chainId, String(seasonId)],
            },
            head,
          );
          if (
            deadline.length !== 1 ||
            !Number.isSafeInteger(confirmedAt) ||
            uint(deadline[0]!, 64) !== end + window ||
            BigInt(confirmedAt) >= uint(deadline[0]!, 64)
          )
            throw new Error("withdrawal_created_outside_claim_window");
          matches.push(seasonId);
        }
        token = page.continuation_token;
        if (token && seen.has(token)) throw new Error("frontier_funding_page_cycle");
        if (token) seen.add(token);
      } while (token);
      if (matches.length !== 1) throw new Error("frontier_funding_missing_or_ambiguous");
      return matches[0]!;
    }),
});
