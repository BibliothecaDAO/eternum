import { Context, Effect, Layer, Schema } from "effect";
import type { Call } from "starknet";
import { uint256 } from "starknet";

import { GAME_LEDGER_ABI } from "./platform/abi/game-ledger";
import { ERC20_ABI } from "./platform/abi/erc20";
import { contractAddress } from "./platform/addresses";
import type { BoundaryDecodeError, RpcError, ValuePlaneNotDeployed } from "./platform/errors";
import { Rpc } from "./platform/rpc";
import { Wallet } from "./platform/wallet";
import { registrationTotal, type RegisterOptions } from "./payouts";

export { computePayouts, registrationTotal } from "./payouts";

export type LedgerReadError = ValuePlaneNotDeployed | RpcError | BoundaryDecodeError;

/**
 * Value facts from the game ledger (contracts/ledger, B.1 frozen ABI), read
 * directly from mainnet. Registration state flips only from these reads — the
 * app never predicts it.
 */

const RawGame = Schema.Struct({
  exists: Schema.Boolean,
  preset_id: Schema.BigInt,
  start: Schema.BigInt,
  end: Schema.BigInt,
  pool: Schema.BigInt,
  registered_count: Schema.BigInt,
  cancelled: Schema.Boolean,
  finalized: Schema.Boolean,
});

const RawPreset = Schema.Struct({
  entry_fee: Schema.BigInt,
  protocol_cut_bps: Schema.BigInt,
  paid_fraction_bps: Schema.BigInt,
  decay_bps: Schema.BigInt,
  sword_price: Schema.BigInt,
  shield_price: Schema.BigInt,
});

const RawRegistration = Schema.Struct({
  registered: Schema.Boolean,
  sword: Schema.Boolean,
  shield: Schema.Boolean,
  paid: Schema.BigInt,
});

const RawPlayerResult = Schema.Struct({
  rank: Schema.BigInt,
  chests: Schema.BigInt,
  payout: Schema.BigInt,
  mmr_before: Schema.BigInt,
  mmr_after: Schema.BigInt,
});

export interface GameEconomy {
  readonly exists: boolean;
  readonly presetId: number;
  readonly start: number;
  readonly end: number;
  readonly pool: bigint;
  readonly registeredCount: number;
  readonly cancelled: boolean;
  readonly finalized: boolean;
}

export interface EconomicPreset {
  readonly entryFee: bigint;
  readonly protocolCutBps: number;
  readonly paidFractionBps: number;
  readonly decayBps: number;
  readonly swordPrice: bigint;
  readonly shieldPrice: bigint;
}

export interface LedgerRegistration {
  readonly registered: boolean;
  readonly sword: boolean;
  readonly shield: boolean;
  readonly paid: bigint;
}

interface LedgerPlayerResult {
  readonly rank: number;
  readonly chests: number;
  readonly payout: bigint;
  readonly mmrBefore: bigint;
  readonly mmrAfter: bigint;
}

const makeLedgerClient = Effect.gen(function* () {
  const rpc = yield* Rpc;
  const wallet = yield* Wallet;

  const ledgerRead = <A>(method: string, args: unknown[], schema: Schema.ConstraintDecoder<A, never>) =>
    contractAddress("ledger").pipe(
      Effect.flatMap((address) => rpc.read({ address, abi: GAME_LEDGER_ABI as never, method, args, schema })),
    );

  const game = (gameId: number): Effect.Effect<GameEconomy, LedgerReadError> =>
    ledgerRead("get_game", [gameId], RawGame).pipe(
      Effect.map((raw) => ({
        exists: raw.exists,
        presetId: Number(raw.preset_id),
        start: Number(raw.start),
        end: Number(raw.end),
        pool: raw.pool,
        registeredCount: Number(raw.registered_count),
        cancelled: raw.cancelled,
        finalized: raw.finalized,
      })),
    );

  const preset = (presetId: number): Effect.Effect<EconomicPreset, LedgerReadError> =>
    ledgerRead("get_preset", [presetId], RawPreset).pipe(
      Effect.map((raw) => ({
        entryFee: raw.entry_fee,
        protocolCutBps: Number(raw.protocol_cut_bps),
        paidFractionBps: Number(raw.paid_fraction_bps),
        decayBps: Number(raw.decay_bps),
        swordPrice: raw.sword_price,
        shieldPrice: raw.shield_price,
      })),
    );

  const registration = (gameId: number, owner: string): Effect.Effect<LedgerRegistration, LedgerReadError> =>
    ledgerRead("get_registration", [gameId, owner], RawRegistration).pipe(
      Effect.map((raw) => ({
        registered: raw.registered,
        sword: raw.sword,
        shield: raw.shield,
        paid: raw.paid,
      })),
    );

  const playerResult = (gameId: number, owner: string): Effect.Effect<LedgerPlayerResult, LedgerReadError> =>
    ledgerRead("get_player_result", [gameId, owner], RawPlayerResult).pipe(
      Effect.map((raw) => ({
        rank: Number(raw.rank),
        chests: Number(raw.chests),
        payout: raw.payout,
        mmrBefore: raw.mmr_before,
        mmrAfter: raw.mmr_after,
      })),
    );

  const games = (gameIds: readonly number[]) =>
    Effect.all(
      gameIds.map((gameId) => game(gameId).pipe(Effect.map((economy) => [gameId, economy] as const))),
      { concurrency: "unbounded" },
    ).pipe(Effect.map((entries) => new Map(entries)));

  const registrations = (gameIds: readonly number[], owner: string) =>
    Effect.all(
      gameIds.map((gameId) => registration(gameId, owner).pipe(Effect.map((row) => [gameId, row] as const))),
      { concurrency: "unbounded" },
    ).pipe(Effect.map((entries) => new Map(entries)));

  const buildRegisterCalls = (input: {
    gameId: number;
    options: RegisterOptions;
    preset: EconomicPreset;
    ledgerAddress: string;
    lordsAddress: string;
  }): Call[] => {
    const total = uint256.bnToUint256(registrationTotal(input.preset, input.options));
    return [
      {
        contractAddress: input.lordsAddress,
        entrypoint: "approve",
        calldata: [input.ledgerAddress, total.low, total.high],
      },
      {
        contractAddress: input.ledgerAddress,
        entrypoint: "register",
        calldata: [input.gameId, input.options.sword ? 1 : 0, input.options.shield ? 1 : 0],
      },
    ];
  };

  // One multicall: LORDS approval folded in front of register. The result of
  // this effect is only the transaction hash — the seat becomes real when a
  // subsequent registration read says so.
  const register = (gameId: number, options: RegisterOptions) =>
    Effect.gen(function* () {
      const ledgerAddress = yield* contractAddress("ledger");
      const lordsAddress = yield* contractAddress("lords");
      const economy = yield* game(gameId);
      const economicPreset = yield* preset(economy.presetId);
      const calls = buildRegisterCalls({
        gameId,
        options,
        preset: economicPreset,
        ledgerAddress,
        lordsAddress,
      });
      return yield* wallet.execute(calls);
    });

  const lordsBalance = (owner: string) =>
    contractAddress("lords").pipe(
      Effect.flatMap((address) =>
        rpc.read({
          address,
          abi: ERC20_ABI as never,
          method: "balance_of",
          args: [owner],
          schema: Schema.BigInt,
        }),
      ),
    );

  return { game, games, preset, registration, registrations, playerResult, register, lordsBalance };
});

type LedgerClientShape = Effect.Success<typeof makeLedgerClient>;

export class LedgerClient extends Context.Service<LedgerClient, LedgerClientShape>()("LedgerClient") {
  static readonly layerWithoutDependencies = Layer.effect(LedgerClient, makeLedgerClient);
  static readonly layer = this.layerWithoutDependencies.pipe(Layer.provide(Layer.merge(Rpc.layer, Wallet.layer)));
}
