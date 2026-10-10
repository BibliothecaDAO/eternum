import { CallData, type Account } from "starknet";
import { confirmedTransactionReceipt } from "../../../config/deployer/clean/shared/transaction";
import { resolveRegistrarExecutionDetails } from "../../../config/deployer/clean/registrar/transaction-details";
import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import { createRegistrarGame } from "../../../config/deployer/clean/registrar/calls";
import {
  buildNativeGameParams,
  loadNativePresetConfiguration,
} from "../../../config/deployer/clean/registrar/native-preset";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import { nativePresetForId } from "../../../config/source/native";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { HarnessProvider } from "./provider";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for private game setup`);
  return value;
};

/** Eternum setup registers each home entitlement before the public player workload starts. */
export async function launchHarnessGame(input: {
  gameName: string;
  gameId?: number;
  minutes: number;
  presetId: number;
  owners: string[];
}) {
  const address = required("DEPLOYER_ACCOUNT_ADDRESS"),
    privateKey = required("DEPLOYER_PRIVATE_KEY");
  const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
  const privateProvider = createHarnessAdminProvider();
  try {
    await assertProviderChain(privateProvider, manifest, "HARNESS_ADMIN_RPC_URL");
    const account = createOperatorAccount(privateProvider, address, privateKey);
    const environment = "madara.eternum";
    const config = loadNativePresetConfiguration(environment, input.presetId);
    const preset = buildNativePreset(config, input.presetId);
    const startAt = Math.floor(Date.now() / 1000) + 60;
    const params = buildNativeGameParams(
      config,
      {
        gameName: input.gameName,
        presetId: input.presetId,
        startMainAt: startAt,
        chainTimestamp: startAt - 60,
        durationSeconds: Math.ceil(input.minutes * 60) + 3600,
        devModeOn: false,
        singleRealmMode: config.settlement.single_realm_mode,
        twoPlayerMode: nativePresetForId(input.presetId).settlementMode === "Duel",
        useMapOverride: false,
      },
      [],
    );
    const gameId = input.gameId ?? (await createRegistrarGame(account, params, manifest, preset)).gameId;
    if (!gameId) throw new Error("Registrar did not return a game id");
    for (const [index, owner] of input.owners.entries())
      await registerHarnessEntitlement(account, manifest.world.address, gameId, owner, index + 1);
    return { gameId, gameName: input.gameName, startAt, settlementTransactions: 0 };
  } finally {
    privateProvider.dispose();
  }
}

/** The pinned metadata encodes geography 1/2/3/2, resources 2/4/7, Order 3 and wonder 1. */
export async function registerHarnessEntitlement(
  account: Account,
  games: string,
  gameId: number,
  owner: string,
  realmId: number,
): Promise<void> {
  const entry = await account.execute(
    {
      contractAddress: games,
      entrypoint: "register_entitlement",
      calldata: CallData.compile({
        key: { game_id: gameId, owner },
        entitlement: {
          realm_id: { low: realmId, high: 0 },
          metadata_1: "0x0103070402020302010009",
          metadata_2: 0,
          metadata_3: 0,
          pass_kind: 1,
        },
      }),
    },
    await resolveRegistrarExecutionDetails(account, games),
  );
  await confirmedTransactionReceipt(account, entry.transaction_hash);
}

/** Administration must bypass the public endpoint's play-only fee and tip policy. */
export function createHarnessAdminProvider(): HarnessProvider {
  return new HarnessProvider(required("HARNESS_ADMIN_RPC_URL"));
}
