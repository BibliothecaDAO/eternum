import { BLITZ_SLOT_PREPARATION_SECONDS, readBlitzRoster } from "@realms-world/value-ledger";
import { RegistrationOpen } from "./blitz-roster";
import { ShardOperator, type PlayPins, type ShardTarget } from "@realms-world/value-ledger/shard";
import { SeatRefused, type LauncherSeats } from "./seat-pipeline";
import { launchSlot, type SlotChain } from "./slot-launch";
import { CairoOption, CairoOptionVariant, shortString } from "starknet";
import { applyDeploymentConfigOverrides } from "../../../config/deployer/clean/config/config-loader";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import { buildCreateGameParams } from "../../../config/deployer/clean/registrar/preset";
import { nativePresetForId } from "../../../config/source/native";
import type { CreateGameRequest } from "./schemas";
import type { ReleaseChain } from "./release";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";

export interface ShardGame {
  name: bigint;
  preset_id: bigint;
  settled: boolean;
  ready: boolean;
  start_settling_at: bigint;
  start_main_at: bigint;
  end_at: bigint;
  end_grace_seconds: bigint;
  seed: bigint;
}

type RosterSeat = { account: string; wallet: string };

/**
 * One game a Blitz launch creates and seats: its durable request, its frozen roster, when its run was queued, and the
 * pool account that seats it.
 */
export interface BlitzLaunch {
  request: CreateGameRequest;
  players: readonly RosterSeat[];
  createdAt: number;
  seater: string;
}

interface CreationParams {
  preset_id: number;
  seed: unknown;
  start_settling_at: number;
  [field: string]: unknown;
}

/** Contract-side name commitment checks the entire immutable request; a retry must find the same identity. */
const assertLaunchIdentity = (game: ShardGame, params: CreationParams) => {
  if (game.preset_id !== BigInt(String(params.preset_id)) || game.seed !== BigInt(String(params.seed)))
    throw new Error("game_launch_identity_differs");
};

const sameRoster = (stored: readonly RosterSeat[], players: readonly RosterSeat[]) =>
  stored.length === players.length &&
  stored.every(
    (row, index) =>
      BigInt(row.wallet) === BigInt(players[index]!.wallet) && BigInt(row.account) === BigInt(players[index]!.account),
  );

/** Current public ABI replaces the launcher's bundled stale ABI and deleted admission/ticket protocol. */
export class LaunchShard extends ShardOperator implements ReleaseChain {
  constructor(target: ShardTarget) {
    super(target);
  }
  gameId(name: string) {
    return this.view<bigint>("game_id_by_name", [shortString.encodeShortString(name)]).then(Number);
  }
  game(gameId: number) {
    return this.view<ShardGame>("game", [gameId]);
  }
  async currentRelease() {
    return Number(await this.view<bigint>("current_release", []));
  }
  async registeredRelease(releaseId: number) {
    const release = await this.view<{ classes: Record<string, bigint>; migration: bigint }>("release", [releaseId]);
    const hex = (value: bigint) => `0x${value.toString(16)}`;
    return {
      logic: Object.fromEntries(Object.entries(release.classes).map(([name, classHash]) => [name, hex(classHash)])),
      migration: hex(release.migration),
    };
  }
  async gameRelease(gameId: number) {
    return Number(await this.view<bigint>("game_release", [gameId]));
  }
  async isSettled(gameId: number) {
    return (await this.game(gameId)).settled;
  }
  async applyRelease(gameId: number, releaseId: number) {
    return (await this.admin("apply_release", { game_id: gameId, release_id: releaseId })).transactionHash;
  }
  /** Creates one open-entry game; a fixed roster launches with its whole slot through `launchBlitz`. */
  async create(request: CreateGameRequest, createdAt: number): Promise<LaunchGameSummary> {
    const params = await this.creationParams(request, createdAt, [], "0x0");
    const { transactionHash } = await this.admin("create_game", { params });
    const gameId = await this.gameId(request.gameName);
    if (!gameId) throw new Error("created_game_not_readable");
    const game = await this.game(gameId);
    assertLaunchIdentity(game, params);
    return { ...this.summaryOf(request, gameId, game), createGameTxHash: transactionHash };
  }
  /**
   * Launches a closed slot's games, or a test Blitz's one game, as one run (see `launchSlot`): every missing create on
   * consecutive nonces from this account, then one seat pipeline per seater over its own games, then one verification.
   * Returns each game's summary in the order given.
   */
  async launchBlitz(launches: readonly BlitzLaunch[]): Promise<LaunchGameSummary[]> {
    const params = await Promise.all(
      launches.map(({ request, createdAt, players, seater }) =>
        this.creationParams(request, createdAt, players, seater),
      ),
    );
    const settlingAt = Math.min(...params.map((game) => game.start_settling_at));
    const now = (await this.head()).timestamp;
    if (now < settlingAt) throw new RegistrationOpen({ secondsUntilClose: settlingAt - now });
    const byName = new Map(
      launches.map((launch, index) => [launch.request.gameName, { ...launch, params: params[index]! }]),
    );
    const games = launches.map(({ request, players, seater }) => ({
      name: request.gameName,
      players: players.length,
      seater,
    }));
    const launched = await launchSlot(this.slotChain(byName), games);
    return Promise.all(
      launched.map(async ({ name, gameId, seats }) => {
        const game = await this.game(gameId);
        const summary = this.summaryOf(byName.get(name)!.request, gameId, game);
        return { ...summary, finalizeAt: Number(game.end_at), settlementTransactions: seats };
      }),
    );
  }
  async roster(gameId: number) {
    return readBlitzRoster(this.provider, this.target.gamesAddress, gameId, (await this.head()).block_number);
  }
  private slotChain(launches: Map<string, BlitzLaunch & { params: CreationParams }>): SlotChain {
    // Each game keeps the release it was created in, so its seats carry its own pins.
    const pins = new Map<number, Promise<PlayPins>>();
    const pinsOf = (gameId: number) => {
      if (!pins.has(gameId)) pins.set(gameId, this.pins(gameId));
      return pins.get(gameId)!;
    };
    const streams = new Map<string, LauncherSeats>();
    return {
      nextNonce: () => this.pendingNonce(),
      gameId: (name) => this.gameId(name),
      sendCreate: (game, nonce) => this.sendAdmin("create_game", { params: launches.get(game.name)!.params }, nonce),
      awaitClosed: (hash) => this.awaitClosed(hash),
      verify: async (game, gameId) => {
        const { params, players, seater } = launches.get(game.name)!;
        assertLaunchIdentity(await this.game(gameId), params);
        if (!sameRoster(await this.roster(gameId), players)) throw new Error("frozen_roster_differs");
        if ((await this.view<bigint>("game_seater", [gameId])) !== BigInt(seater))
          throw new Error("game_seater_differs");
        await pinsOf(gameId);
      },
      ready: (gameId) => this.rosterReady(gameId),
      seats: (seater) => {
        if (!streams.has(seater)) streams.set(seater, this.seaterStream(seater, pinsOf));
        return streams.get(seater)!;
      },
    };
  }
  /** The operator signing as one seater: the same device key signs for every pool account. */
  seaterAccount(seater: string): ShardOperator {
    return new ShardOperator({ ...this.target, accountAddress: seater });
  }
  /** One seater's own nonce sequence. */
  private seaterStream(seater: string, pinsOf: (gameId: number) => Promise<PlayPins>): LauncherSeats {
    const account = this.seaterAccount(seater);
    const sent = new Map<bigint, { gameId: number; hash: string }>();
    return {
      nextNonce: () => account.pendingNonce(),
      send: async (nonce, gameId) => {
        try {
          sent.set(nonce, { gameId, hash: await account.sendSeat(await pinsOf(gameId), nonce) });
        } catch (error) {
          if (error instanceof Error && error.message === "shard_seat_refused") throw new SeatRefused();
          throw error;
        }
      },
      result: (nonce) => {
        const seat = sent.get(nonce)!;
        return account.seatOutcome(seat.gameId, seat.hash);
      },
    };
  }
  private summaryOf(request: CreateGameRequest, gameId: number, game: ShardGame): LaunchGameSummary {
    return {
      environment: request.environment,
      chain: "madara",
      gameType: nativePresetForId(Number(request.version)).gameType,
      gameName: request.gameName,
      gameId,
      worldAddress: this.target.gamesAddress,
      rpcUrl: this.target.rpcUrl,
      startTime: Number(game.start_main_at),
      startTimeIso: new Date(Number(game.start_main_at) * 1000).toISOString(),
      durationSeconds: Number(game.end_at - game.start_main_at),
      configMode: "batched",
      configSteps: [],
      dryRun: false,
    };
  }
  private async creationParams(
    request: CreateGameRequest,
    createdAt: number,
    players: readonly RosterSeat[],
    seater: string,
  ): Promise<CreationParams> {
    if (!request.gameStartTime || !request.version) throw new Error("durable_launch_parameters_missing");
    const presetId = Number(request.version);
    const preset = nativePresetForId(presetId);
    const config = applyDeploymentConfigOverrides(loadNativePresetConfiguration(request.environment, presetId), {
      startMainAt: Math.floor(Date.parse(request.gameStartTime) / 1000),
      factoryAddress: "",
      durationSeconds: request.durationSeconds,
      mapConfigOverrides: request.mapConfigOverrides,
      biomeClimateOverrides: request.biomeClimateOverrides,
      blitzRegistrationOverrides: request.blitzRegistrationOverrides,
    });
    const startMainAt = Math.floor(Date.parse(request.gameStartTime) / 1000);
    const startSettlingAt = startMainAt - (request.environment === "madara.blitz" ? BLITZ_SLOT_PREPARATION_SECONDS : 0);
    const common = buildCreateGameParams(config, {
      gameName: request.gameName,
      presetId,
      startMainAt,
      chainTimestamp: startMainAt,
      durationSeconds: request.durationSeconds ?? config.season.durationSeconds,
      devModeOn: request.devModeOn ?? false,
      singleRealmMode: false,
      twoPlayerMode: preset.settlementMode === "Duel",
      useMapOverride: !!request.mapConfigOverrides,
    });
    return {
      name: common.name,
      preset_id: presetId,
      start_settling_at: startSettlingAt,
      start_main_at: startMainAt,
      duration_seconds: common.duration_seconds,
      end_grace_seconds: common.end_grace_seconds,
      dev_mode_on: common.dev_mode_on,
      roster: players,
      seater,
      registration_start: Math.min(Math.floor(createdAt / 1000), startSettlingAt - 1),
      biome_climate: common.biome_climate_config,
      map_override: new CairoOption(
        request.mapConfigOverrides ? CairoOptionVariant.Some : CairoOptionVariant.None,
        common.map_override,
      ),
      seed: common.seed,
    };
  }
}
