import { rpcAt, readConfirmedLedgerHead, decodeFrontierSeason } from "@realms-world/value-ledger";
import { ShardReader, uint } from "./shard-rpc";
import { relayOperation } from "./ports";

type Ledger = { rpcUrl: string; address: string };

/** Frontier funding uses the shard game id as its season id. */
export const frontierReceiptBindings = (
  reader: ShardReader,
  ledger: Ledger,
  identity: { realmsIdForAccount(account: string): Promise<string | null> },
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
      const provider = rpcAt(ledger.rpcUrl);
      const head = await readConfirmedLedgerHead(provider);
      const season = decodeFrontierSeason(
        await provider.callContract(
          {
            contractAddress: ledger.address,
            entrypoint: "get_frontier",
            calldata: [reader.connection.chainId, String(gameId)],
          },
          head.number,
        ),
      );
      if (
        !season.configured ||
        BigInt(season.start) !== uint(game[6]!, 64) ||
        BigInt(season.seed) !== uint(game[9]!, 252)
      )
        throw new Error("frontier_funding_differs_from_game");
      const deadline = await provider.callContract(
        {
          contractAddress: ledger.address,
          entrypoint: "frontier_claim_deadline",
          calldata: [reader.connection.chainId, String(gameId)],
        },
        head.number,
      );
      if (deadline.length !== 1) throw new Error("frontier_claim_deadline_abi_differs");
      if (!Number.isSafeInteger(confirmedAt) || confirmedAt < 0 || BigInt(confirmedAt) >= uint(deadline[0]!, 64))
        throw new Error("withdrawal_created_outside_claim_window");
      return gameId;
    }),
});
