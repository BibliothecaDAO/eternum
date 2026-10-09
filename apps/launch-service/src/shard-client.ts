import { ShardOperator, batchRemaining, type ShardTarget } from "@realms-world/value-ledger/shard";
import { CairoOption, CairoOptionVariant, shortString } from "starknet";
import { applyDeploymentConfigOverrides } from "../../../config/deployer/clean/config/config-loader";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import { buildCreateGameParams } from "../../../config/deployer/clean/registrar/preset";
import { nativePresetForId } from "../../../config/source/native";
import { RegistrationOpen } from "./blitz-roster";
import type { CreateGameRequest } from "./schemas";
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

/** Current public ABI replaces the launcher's bundled stale ABI and deleted admission/ticket protocol. */
export class LaunchShard extends ShardOperator {
  constructor(target: ShardTarget) {
    super(target);
  }
  gameId(name: string) {
    return this.view<bigint>("game_id_by_name", [shortString.encodeShortString(name)]).then(Number);
  }
  game(gameId: number) {
    return this.view<ShardGame>("game", [gameId]);
  }
  async create(request: CreateGameRequest, createdAt: number): Promise<LaunchGameSummary> {
    const params = await this.creationParams(request, createdAt);
    // Contract-side name commitment checks the entire immutable request on every retry.
    const transactionHash = (await this.admin("create_game", { params })).transactionHash;
    const gameId = await this.gameId(request.gameName);
    if (!gameId) throw new Error("created_game_not_readable");
    const game = await this.game(gameId);
    if (game.preset_id !== BigInt(String(params.preset_id)) || game.seed !== BigInt(String(params.seed)))
      throw new Error("game_launch_identity_differs");
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
      ...(transactionHash ? { createGameTxHash: transactionHash } : {}),
    };
  }
  async installRoster(gameId: number, players: readonly { wallet: string; account: string }[]) {
    await this.admin("freeze_blitz_roster", {
      game_id: gameId,
      players: players.map(({ account, wallet }) => ({ account, wallet })),
    });
    const stored = await this.view<{ wallet: bigint; account: bigint }[]>("blitz_roster", [gameId]);
    if (
      stored.length !== players.length ||
      stored.some(
        (row, index) =>
          row.wallet !== BigInt(players[index]!.wallet) || row.account !== BigInt(players[index]!.account),
      )
    )
      throw new Error("frozen_roster_differs");
  }
  async seat(gameId: number) {
    let transactions = 0;
    while (!(await this.game(gameId)).ready) {
      const start = Number((await this.game(gameId)).start_settling_at);
      const now = (await this.head()).timestamp;
      if (now < start) throw new RegistrationOpen({ secondsUntilClose: start - now });
      const result = await this.play(gameId, ["7"]);
      const remaining = batchRemaining(result.events, this.target.gamesAddress, gameId, result.transactionHash);
      if (++transactions > 24) throw new Error("roster_seating_did_not_finish");
      if (!remaining && !(await this.game(gameId)).ready) throw new Error("roster_completion_not_ready");
    }
    return transactions;
  }
  private async creationParams(request: CreateGameRequest, createdAt: number) {
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
    const common = buildCreateGameParams(config, {
      gameName: request.gameName,
      presetId,
      startMainAt,
      chainTimestamp: (await this.head()).timestamp,
      durationSeconds: request.durationSeconds ?? config.season.durationSeconds,
      devModeOn: request.devModeOn ?? false,
      singleRealmMode: false,
      twoPlayerMode: preset.settlementMode === "Duel",
      useMapOverride: !!request.mapConfigOverrides,
    });
    return {
      name: common.name,
      preset_id: presetId,
      start_settling_at: startMainAt,
      start_main_at: startMainAt,
      duration_seconds: common.duration_seconds,
      end_grace_seconds: common.end_grace_seconds,
      dev_mode_on: common.dev_mode_on,
      roster: [],
      registration_start: Math.min(Math.floor(createdAt / 1000), startMainAt - 1),
      biome_climate: common.biome_climate_config,
      map_override: new CairoOption(
        request.mapConfigOverrides ? CairoOptionVariant.Some : CairoOptionVariant.None,
        common.map_override,
      ),
      seed: common.seed,
    };
  }
}
