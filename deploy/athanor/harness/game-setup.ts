import { CallData } from "starknet";
import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import { createRegistrarGame } from "../../../config/deployer/clean/registrar/calls";
import {
  buildNativeGameParams,
  loadNativePresetConfiguration,
} from "../../../config/deployer/clean/registrar/native-preset";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import { nativePresetForId } from "../../../config/source/native";
import { confirmedTransactionReceipt } from "../../../config/deployer/clean/shared/transaction";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import type { Shard } from "@bibliothecadao/eternum/game-client";
import { connectHarnessGameClient } from "./game-client";
import { HarnessProvider } from "./provider";
import { readPlayBounds } from "./player-invoke";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for private game setup`);
  return value;
};

/** Existing registrar payloads create the game privately; launcher gameplay follows the same signed public path. */
export async function launchHarnessGame(input: {
  gameName: string;
  gameType: "blitz" | "eternum";
  minutes: number;
  presetId: number;
  rosterAccounts: string[];
  shard: Shard;
  publicProvider: HarnessProvider;
}) {
  const privateProvider = new HarnessProvider(required("HARNESS_ADMIN_RPC_URL"));
  const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
  const address = required("DEPLOYER_ACCOUNT_ADDRESS"),
    privateKey = required("DEPLOYER_PRIVATE_KEY");
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
      input.gameType === "blitz" ? input.rosterAccounts.map((account) => ({ account })) : [],
    );
    const created = await createRegistrarGame(account, params, manifest, preset);
    if (!created.gameId) throw new Error("Registrar did not return a game id");
    const settlementTransactions =
      input.gameType === "blitz"
        ? await settleHarnessRoster(created.gameId, input.shard, input.publicProvider, manifest, address, privateKey)
        : 0;
    return { gameId: created.gameId, gameName: input.gameName, startAt, settlementTransactions };
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
    provider: provider,
    playBounds: readPlayBounds(manifest),
  });
  try {
    const launcher = createOperatorAccount(provider, address, privateKey);
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

/** The launcher reserves free/open homes outside gameplay; no shared allocator is invoked by a bot. */
export async function prepareOpenHomes(gameId: number, owners: string[]): Promise<void> {
  const provider = new HarnessProvider(required("HARNESS_ADMIN_RPC_URL"));
  try {
    const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
    await assertProviderChain(provider, manifest, "HARNESS_ADMIN_RPC_URL");
    const launcher = createOperatorAccount(
      provider,
      required("DEPLOYER_ACCOUNT_ADDRESS"),
      required("DEPLOYER_PRIVATE_KEY"),
    );
    for (const call of prepareHomeCalls(manifest.world.address, gameId, owners)) {
      const sent = await launcher.execute(call);
      await confirmedTransactionReceipt(provider, sent.transaction_hash);
    }
  } finally {
    provider.dispose();
  }
}

export function prepareHomeCalls(games: string, gameId: number, owners: readonly string[]) {
  if (
    !Number.isSafeInteger(gameId) ||
    gameId <= 0 ||
    owners.length === 0 ||
    new Set(owners.map((owner) => BigInt(owner).toString())).size !== owners.length
  )
    throw new Error("Home preparation requires one game and distinct approved owners");
  const calls = [];
  for (let offset = 0; offset < owners.length; offset += 64)
    calls.push({
      contractAddress: games,
      entrypoint: "prepare_homes",
      calldata: CallData.compile({ game_id: gameId, owners: owners.slice(offset, offset + 64) }),
    });
  return calls;
}
