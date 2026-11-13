import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import { createRegistrarGame } from "../../../config/deployer/clean/registrar/calls";
import {
  buildNativeGameParams,
  loadNativePresetConfiguration,
} from "../../../config/deployer/clean/registrar/native-preset";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import { nativePresetForId } from "../../../config/source/native";
import { GAME_ENVIRONMENTS } from "../../../config/shared/game-environments";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { HarnessProvider } from "./provider";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for private game setup`);
  return value;
};

export async function launchHarnessGame(input: {
  gameName: string;
  gameId?: number;
  minutes: number;
  presetId: number;
}) {
  const environment = environmentOfPreset(input.presetId);
  const config = loadNativePresetConfiguration(environment, input.presetId);
  const preset = buildNativePreset(config, input.presetId);
  const address = required("DEPLOYER_ACCOUNT_ADDRESS"),
    privateKey = required("DEPLOYER_PRIVATE_KEY");
  const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
  const privateProvider = createHarnessAdminProvider();
  try {
    await assertProviderChain(privateProvider, manifest, "HARNESS_ADMIN_RPC_URL");
    const account = createOperatorAccount(privateProvider, address, privateKey);
    const startAt = Math.floor(Date.now() / 1000) + 60;
    const params = buildNativeGameParams(config, {
      gameName: input.gameName,
      presetId: input.presetId,
      startMainAt: startAt,
      chainTimestamp: startAt - 60,
      durationSeconds: harnessSeasonSeconds(preset.rules.tick_config.armies_tick_in_seconds, input.minutes),
      devModeOn: false,
      singleRealmMode: config.settlement.single_realm_mode,
      useMapOverride: false,
    });
    const gameId = input.gameId ?? (await createRegistrarGame(account, params, manifest, preset)).gameId;
    if (!gameId) throw new Error("Registrar did not return a game id");
    return { gameId, gameName: input.gameName, startAt, settlementTransactions: 0 };
  } finally {
    privateProvider.dispose();
  }
}

/** Administration must bypass the public endpoint's play-only fee and tip policy. */
export function createHarnessAdminProvider(): HarnessProvider {
  return new HarnessProvider(required("HARNESS_ADMIN_RPC_URL"));
}

/** A harness game outlasts its run by an hour and ends on its army tick. */
export function harnessSeasonSeconds(armyTickSeconds: number, minutes: number): number {
  const seconds = Math.ceil(minutes * 60) + 3600;
  return Math.ceil(seconds / armyTickSeconds) * armyTickSeconds;
}

/** The deployment environment whose preset definitions hold this preset (Frontier presets live in madara.frontier). */
function environmentOfPreset(presetId: number) {
  const gameType = nativePresetForId(presetId).environmentGameType;
  const environment = GAME_ENVIRONMENTS.find((entry) => entry.gameType === gameType);
  if (!environment) throw new Error(`No deployment environment for preset ${presetId}`);
  return environment.id;
}
