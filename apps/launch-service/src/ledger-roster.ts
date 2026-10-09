import { Effect } from "effect";
import { readLedgerGame, readRegisteredWallets, rpcAt, type LedgerGameKey } from "@realms-world/value-ledger";
import { normalizeAddress } from "./address";
import { RegistrationOpen, RosterFailure, type BlitzRegistrationSource } from "./blitz-roster";

interface LedgerRosterDependencies {
  rpcUrl: string;
  ledgerAddress: string;
  /** The immutable reserved GameKey must exist before ledger registration opens. */
  resolveGameKey(chainId: string, gameName: string): Effect.Effect<LedgerGameKey, RosterFailure>;
  accountForWallet(wallet: string): Promise<string | null>;
}

/** The complete L2 roster at a single confirmed head, mapped to the official shard's Realms accounts. */
export const ledgerBlitzRegistrations = (dependencies: LedgerRosterDependencies): BlitzRegistrationSource => ({
  readClosed: (key) =>
    Effect.gen(function* () {
      const gameKey = yield* dependencies.resolveGameKey(key.chainId, key.gameName);
      if (BigInt(gameKey.chainId) !== BigInt(key.chainId))
        return yield* Effect.fail(new RosterFailure({ operation: "ledger_game_chain_differs" }));
      const snapshot = yield* rosterRead("read ledger registration", () => readLedgerRoster(dependencies, gameKey));
      if (snapshot.secondsUntilClose > 0)
        return yield* Effect.fail(new RegistrationOpen({ secondsUntilClose: snapshot.secondsUntilClose }));
      const registrations = [];
      for (const wallet of snapshot.wallets) {
        const account = yield* rosterRead("resolve registered wallet", () => dependencies.accountForWallet(wallet));
        if (!account) return yield* Effect.fail(new RosterFailure({ operation: "registered_wallet_not_linked" }));
        registrations.push({ wallet: normalizeAddress(wallet), account: normalizeAddress(account) });
      }
      return {
        gameId: gameKey.gameId,
        blockNumber: snapshot.blockNumber,
        blockHash: snapshot.blockHash,
        registrations,
      };
    }),
});

const readLedgerRoster = async (dependencies: LedgerRosterDependencies, key: LedgerGameKey) => {
  const provider = rpcAt(dependencies.rpcUrl);
  const block = await provider.getBlock("latest");
  if (!("block_number" in block) || !("block_hash" in block)) throw new Error("ledger_head_not_confirmed");
  const game = await readLedgerGame(provider, dependencies.ledgerAddress, key, block.block_number);
  if (game.cancelled || game.finalized || block.timestamp >= game.end) throw new Error("ledger_game_closed");
  const secondsUntilClose = Math.max(0, game.start - block.timestamp);
  const wallets =
    secondsUntilClose > 0
      ? []
      : await readRegisteredWallets(
          provider,
          dependencies.ledgerAddress,
          key,
          block.block_number,
          game.registeredCount,
        );
  return { blockNumber: block.block_number, blockHash: block.block_hash, secondsUntilClose, wallets };
};
const rosterRead = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: () => new RosterFailure({ operation }) });
