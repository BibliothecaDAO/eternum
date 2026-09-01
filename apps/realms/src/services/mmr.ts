import { Effect, Schema } from "effect";

import { MMR_TOKEN_ABI } from "./platform/abi/mmr-token";
import { contractAddress } from "./platform/addresses";
import type { BoundaryDecodeError, RpcError, ValuePlaneNotDeployed } from "./platform/errors";
import { Rpc } from "./platform/rpc";

export type MmrReadError = ValuePlaneNotDeployed | RpcError | BoundaryDecodeError;

export const MMR_TOKEN_DECIMALS = 10n ** 18n;

export const mmrToInteger = (raw: bigint): number => Number(raw / MMR_TOKEN_DECIMALS);

interface MmrTier {
  readonly name: string;
  readonly minMMR: number;
  readonly color: string;
}

// Tier thresholds shared with the game client (apps/game mmr-tiers); colors are
// this app's palette.
const MMR_TIERS: MmrTier[] = [
  { name: "Storm Lord", minMMR: 2400, color: "text-gold-hot" },
  { name: "Warlord", minMMR: 2000, color: "text-loss" },
  { name: "Conqueror", minMMR: 1600, color: "text-info" },
  { name: "Marauder", minMMR: 1200, color: "text-win" },
  { name: "Raider", minMMR: 600, color: "text-gold" },
  { name: "Scrapper", minMMR: 0, color: "text-muted" },
];

export const mmrTier = (mmr: number): MmrTier =>
  MMR_TIERS.find((tier) => mmr >= tier.minMMR) ?? (MMR_TIERS[MMR_TIERS.length - 1] as MmrTier);

/** Live ratings from the mainnet MMRToken — the one truth for a player's rating. */
export class MmrClient extends Effect.Service<MmrClient>()("MmrClient", {
  dependencies: [Rpc.Default],
  effect: Effect.gen(function* () {
    const rpc = yield* Rpc;

    const rating = (player: string): Effect.Effect<bigint, MmrReadError> =>
      contractAddress("mmrToken").pipe(
        Effect.flatMap((address) =>
          rpc.read({
            address,
            abi: MMR_TOKEN_ABI as never,
            method: "get_player_mmr",
            args: [player],
            schema: Schema.BigIntFromSelf,
          }),
        ),
      );

    const ratings = (players: readonly string[]) =>
      Effect.all(
        players.map((player) => rating(player).pipe(Effect.map((value) => [player, value] as const))),
        { concurrency: 25 },
      ).pipe(Effect.map((entries) => new Map(entries)));

    return { rating, ratings };
  }),
}) {}
