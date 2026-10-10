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
import type { Shard } from "@bibliothecadao/eternum/game-client";
import { connectHarnessGameClient } from "./game-client";
import { HarnessProvider } from "./provider";
import { configureGameplayAccountSubmits } from "@bibliothecadao/eternum/game-client";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for private game setup`);
  return value;
};

/** Existing registrar payloads create the game privately; launcher gameplay follows the same signed public path. */
export async function launchHarnessGame(input: {
  gameName: string;
  gameId?: number;
  gameType: "blitz" | "eternum";
  minutes: number;
  presetId: number;
  rosterAccounts: string[];
  shard: Shard;
  publicProvider: HarnessProvider;
}) {
  const address = required("DEPLOYER_ACCOUNT_ADDRESS"),
    privateKey = required("DEPLOYER_PRIVATE_KEY");
  const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
  const privateProvider = createHarnessAdminProvider();
  try {
    await assertProviderChain(privateProvider, manifest, "HARNESS_ADMIN_RPC_URL");
    const account = createOperatorAccount(privateProvider, address, privateKey);
    const environment = input.gameType === "blitz" ? "madara.blitz" : "madara.eternum";
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
      input.gameType === "blitz" ? input.rosterAccounts.map((account) => ({ account, wallet: account })) : [],
    );
    const gameId = input.gameId ?? (await createRegistrarGame(account, params, manifest, preset)).gameId;
    if (!gameId) throw new Error("Registrar did not return a game id");
    if (input.gameType === "eternum")
      for (const [index, owner] of input.rosterAccounts.entries())
        await registerHarnessEntitlement(account, manifest.world.address, gameId, owner, index + 1);
    const settlementTransactions =
      input.gameType === "blitz"
        ? await settleHarnessRoster(gameId, input.shard, input.publicProvider, manifest, address, privateKey)
        : 0;
    return { gameId, gameName: input.gameName, startAt, settlementTransactions };
  } finally {
    privateProvider.dispose();
  }
}

async function settleHarnessRoster(
  gameId: number,
  shard: Shard,
  provider: HarnessProvider,
  manifest: NativeWorldManifest,
  address: string,
  privateKey: string,
): Promise<number> {
  let settlementTransactions = 0;
  const connection = await connectHarnessGameClient({
    actor: address,
    gameId: gameId,
    shard: shard,
  });
  try {
    const launcher = configureGameplayAccountSubmits(createOperatorAccount(provider, address, privateKey), shard);
    while (!connection.client.setup.store.require("GameRegistry", { game_id: gameId }).ready) {
      await connection.client.setup.network.provider.submitCommand(launcher, {
        kind: "SettleBlitzRoster",
        value: undefined,
      });
      settlementTransactions++;
    }
  } finally {
    connection.client.dispose();
  }
  return settlementTransactions;
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
