import { BLITZ_SLOT_PREPARATION_SECONDS } from "@realms-world/value-ledger";
import { ShardOperator, type ShardTarget } from "@realms-world/value-ledger/shard";
import { CairoOption, CairoOptionVariant, shortString } from "starknet";
import { applyDeploymentConfigOverrides } from "../../../config/deployer/clean/config/config-loader";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import { buildCreateGameParams } from "../../../config/deployer/clean/registrar/preset";
import { presetIdForEnvironment } from "../../../config/deployer/clean/constants";
import { resolveDeploymentEnvironment } from "../../../config/deployer/clean/environment";
import { testnetPresetId, type CreateGameRequest } from "./schemas";
import type { ReleaseChain } from "./release";
import type { LaunchGameSummary } from "../../../config/deployer/clean/types";
import type { NativeRows } from "../../../contracts/l3/world-native/schema/client.gen";

type RegistryRow = Omit<NativeRows["GameRegistry"], "game_id">;
type ShardGame = { [Field in keyof RegistryRow]: RegistryRow[Field] extends boolean ? boolean : bigint };

/** Contract-side name commitment checks the entire immutable request; a retry must find the same identity. */
const assertLaunchIdentity = (game: ShardGame, params: ReturnType<typeof launchGameParams>) => {
  const launched = [
    [game.name, params.name],
    [game.family, params.family],
    [game.seed, params.seed],
    [game.start_settling_at, params.start_settling_at],
    [game.start_main_at, params.start_main_at],
    [game.scheduled_end_at, params.start_main_at + Number(params.duration_seconds)],
  ] as const;
  if (launched.some(([held, requested]) => held !== BigInt(String(requested))))
    throw new Error("game_launch_identity_differs");
};

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
  async openReleaseOf(family: number) {
    return Number(await this.view<bigint>("open_release_of", [family]));
  }
  async latestReleaseOf(family: number) {
    return Number(await this.view<bigint>("latest_release_of", [family]));
  }
  releaseRegistered(releaseId: number) {
    return this.view<boolean>("release_registered", [releaseId]);
  }
  async registeredRelease(releaseId: number) {
    const release = await this.view<{ family: bigint; previous: bigint; migration: bigint }>("release", [releaseId]);
    const classes = await this.view<bigint[]>("release_classes", [releaseId]);
    const hex = (value: bigint) => `0x${value.toString(16)}`;
    return {
      family: Number(release.family),
      previous: Number(release.previous),
      logic: classes.map(hex),
      migration: hex(release.migration),
    };
  }
  async gameRelease(gameId: number) {
    return Number(await this.view<bigint>("game_release", [gameId]));
  }
  async applyRelease(gameId: number, releaseId: number) {
    return (await this.admin("apply_release", { game_id: gameId, release_id: releaseId })).transactionHash;
  }
  async openRelease(releaseId: number) {
    return (await this.admin("open_release", { release_id: releaseId })).transactionHash;
  }
  async create(request: CreateGameRequest, createdAt: number): Promise<LaunchGameSummary> {
    const params = launchGameParams(request, createdAt);
    const { transactionHash } = await this.admin("create_game", { params });
    const gameId = await this.gameId(request.gameName);
    if (!gameId) throw new Error("created_game_not_readable");
    const game = await this.game(gameId);
    assertLaunchIdentity(game, params);
    return { ...this.summaryOf(request, gameId, game), createGameTxHash: transactionHash };
  }
  private summaryOf(request: CreateGameRequest, gameId: number, game: ShardGame): LaunchGameSummary {
    return {
      environment: request.environment,
      chain: "madara",
      gameType: resolveDeploymentEnvironment(request.environment).gameType,
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
}

function launchGameParams(request: CreateGameRequest, createdAt: number) {
  if (!request.gameStartTime) throw new Error("durable_launch_parameters_missing");
  const presetId =
    request.speed === undefined ? presetIdForEnvironment(request.environment) : testnetPresetId(request.speed);
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
    useMapOverride: !!request.mapConfigOverrides,
  });
  return {
    name: common.name,
    family: common.family,
    start_settling_at: startSettlingAt,
    start_main_at: startMainAt,
    duration_seconds: common.duration_seconds,
    dev_mode_on: common.dev_mode_on,
    registration_start: Math.min(Math.floor(createdAt / 1000), startSettlingAt - 1),
    biome_climate: common.biome_climate_config,
    map_override: new CairoOption(
      request.mapConfigOverrides ? CairoOptionVariant.Some : CairoOptionVariant.None,
      common.map_override,
    ),
    seed: common.seed,
    clock_scale: common.clock_scale,
  };
}
