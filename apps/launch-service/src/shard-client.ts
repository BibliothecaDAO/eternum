import { RegistrationOpen } from "./blitz-roster";
import { ShardOperator, batchRemaining, type ShardTarget } from "@realms-world/value-ledger/shard";
import { CairoOption, CairoOptionVariant, shortString, hash } from "starknet";
import { applyDeploymentConfigOverrides } from "../../../config/deployer/clean/config/config-loader";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import { buildCreateGameParams } from "../../../config/deployer/clean/registrar/preset";
import { nativePresetForId } from "../../../config/source/native";
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
  async create(
    request: CreateGameRequest,
    createdAt: number,
    onSubmitted?: (hash: string) => Promise<void>,
    players: readonly { account: string; wallet: string }[] = [],
  ): Promise<LaunchGameSummary> {
    if (request.environment === "madara.blitz" && !players.length) throw new Error("blitz_roster_required");
    const params = await this.creationParams(request, createdAt, players);
    // Contract-side name commitment checks the entire immutable request on every retry.
    const existingId = request.environment === "madara.blitz" ? await this.gameId(request.gameName) : 0;
    const transactionHash = existingId
      ? undefined
      : (await this.admin("create_game", { params }, onSubmitted)).transactionHash;
    const gameId = await this.gameId(request.gameName);
    if (!gameId) throw new Error("created_game_not_readable");
    const game = await this.game(gameId);
    if (game.preset_id !== BigInt(String(params.preset_id)) || game.seed !== BigInt(String(params.seed)))
      throw new Error("game_launch_identity_differs");
    if (request.environment === "madara.blitz") {
      const stored = await this.roster(gameId);
      if (
        stored.length !== players.length ||
        stored.some(
          (row, index) =>
            BigInt(row.wallet) !== BigInt(players[index]!.wallet) ||
            BigInt(row.account) !== BigInt(players[index]!.account),
        )
      )
        throw new Error("frozen_roster_differs");
    }
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
  async creationTransaction(name: string, presetId: number, fromBlock: number) {
    const head = await this.head();
    let token: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await this.provider.getEvents({
        address: this.target.gamesAddress,
        from_block: { block_number: fromBlock },
        to_block: { block_number: head.block_number },
        chunk_size: 100,
        ...(token ? { continuation_token: token } : {}),
      });
      const candidates = new Set(page.events.map((event) => event.transaction_hash));
      for (const txHash of candidates) {
        const tx = await this.provider.getTransactionByHash(txHash);
        if (!isCheckCreation(tx, this.target, name, presetId)) continue;
        await this.confirm(txHash);
        return txHash;
      }
      token = page.continuation_token;
      if (token && seen.has(token)) throw new Error("launcher_creation_page_cycle");
      if (token) seen.add(token);
    } while (token);
    throw new Error("launcher_original_creation_missing");
  }
  async roster(gameId: number) {
    const rows = await this.view<{ wallet: bigint; account: bigint }[]>("blitz_roster", [gameId]);
    return rows.map((row) => ({ wallet: `0x${row.wallet.toString(16)}`, account: `0x${row.account.toString(16)}` }));
  }
  async seat(gameId: number) {
    let transactions = 0;
    let previousRemaining: bigint | undefined;
    while (!(await this.game(gameId)).ready) {
      const start = Number((await this.game(gameId)).start_settling_at);
      const now = (await this.head()).timestamp;
      if (now < start) throw new RegistrationOpen({ secondsUntilClose: start - now });
      const result = await this.playCommand(gameId, "SettleBlitzRoster");
      const remaining = batchRemaining(result.events, this.target.gamesAddress, result.transactionHash, {
        gameId,
        missing: "reject",
      });
      transactions++;
      if (previousRemaining !== undefined && remaining >= previousRemaining)
        throw new Error("roster_seating_did_not_progress");
      previousRemaining = remaining;
      if (!remaining && !(await this.game(gameId)).ready) throw new Error("roster_completion_not_ready");
    }
    return transactions;
  }
  private async creationParams(
    request: CreateGameRequest,
    createdAt: number,
    players: readonly { account: string; wallet: string }[],
  ) {
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
      start_settling_at: startMainAt,
      start_main_at: startMainAt,
      duration_seconds: common.duration_seconds,
      end_grace_seconds: common.end_grace_seconds,
      dev_mode_on: common.dev_mode_on,
      roster: players,
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

const isCheckCreation = (
  tx: Awaited<ReturnType<ShardOperator["provider"]["getTransactionByHash"]>>,
  target: ShardTarget,
  name: string,
  presetId: number,
) => {
  if (!("sender_address" in tx) || BigInt(tx.sender_address) !== BigInt(target.accountAddress) || !("calldata" in tx))
    return false;
  const data = tx.calldata;
  return (
    data.length >= 6 &&
    BigInt(data[0]!) === 1n &&
    BigInt(data[1]!) === BigInt(target.gamesAddress) &&
    BigInt(data[2]!) === BigInt(hash.getSelectorFromName("create_game")) &&
    BigInt(data[3]!) === BigInt(data.length - 4) &&
    BigInt(data[4]!) === BigInt(shortString.encodeShortString(name)) &&
    BigInt(data[5]!) === BigInt(presetId)
  );
};
