import { upgradeRecipes } from "./upgrade-recipes";
import { sourceProvenance } from "./source-provenance";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { runMeasuredSlice } from "./measured-slice";
import { discoveryFixture } from "./root-fixture";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Account, CallData, CairoCustomEnum, RpcProvider, ec, type Call, type RawArgs } from "starknet";
import { createGameClient } from "@bibliothecadao/eternum";
import { buildWorldDeployment } from "@bibliothecadao/eternum/game-client";
import { createMicrotaskGameSyncScheduler } from "@bibliothecadao/eternum/game-sync";
import { resolveGameTransactionResourceBounds, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { createMadaraAccount } from "../../../../config/deployer/clean/shared/madara-account";
import { waitForSuccess } from "../../../../config/deployer/clean/shared/declare";
import { getConfigFromNetwork } from "../../../../config/utils/utils";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";
import parity from "../../../../contracts/l3/world-native/fixtures/world-parity.json";
import { observeActions } from "./action-evidence";

const provenance = await sourceProvenance(true);
const root = resolve(import.meta.dir, "../../../..");
const lab = resolve(root, "deploy/madara-lab/.lab");
const rpcUrl = "http://127.0.0.1:5050/rpc/v0_10_2";
const resourceBounds = resolveGameTransactionResourceBounds("madara");
const gameId = Number(process.argv[2]);
if (!Number.isSafeInteger(gameId) || gameId < 1) throw new Error("Usage: bun run-slice.ts NEW_GAME_ID");
const manifest = await Bun.file(resolve(lab, "native-world-manifest.json")).json();
const identity = await Bun.file(resolve(lab, "gameplay-contracts.json")).json();
const records: { address: string; privateKey: string }[] = await Bun.file(
  resolve(lab, "native-history-accounts.private.json"),
).json();
const profile = Bun.TOML.parse(await readFile(resolve(root, "contracts/l3/game/dojo_madara.toml"), "utf8")) as {
  env: { account_address: string; private_key: string };
};
const provider = new RpcProvider({ nodeUrl: rpcUrl });
const admin = createMadaraAccount(provider, profile.env.account_address, profile.env.private_key);
const sequencing = await Bun.file(resolve(lab, "native-sequencer.json")).json();
const sequencer = createMadaraAccount(provider, sequencing.address, sequencing.signingKey);
const players = records.map((record) => new Account({ provider, address: record.address, signer: record.privateKey }));
const artifacts = Object.fromEntries(
  await Promise.all(
    Object.entries(manifest.native.schemas[manifest.native.activeSchema].domains).map(async ([name, domain]) => [
      name,
      await Bun.file(
        resolve(
          root,
          `contracts/l3/world-native/target/dev/world_native_${(domain as { contract: string }).contract}.contract_class.json`,
        ),
      ).json(),
    ]),
  ),
);
const setupTransactions: string[] = [];
const evidence = observeActions();
let timestamp = (await provider.getBlock("pre_confirmed")).timestamp;
let confirmedTimestamp = (await provider.getBlock("latest")).timestamp;
const discovery = discoveryFixture(gameId, () => confirmedTimestamp);
const roots: { command: string; timestamp: number; root: string; desired: string }[] = [];

await prepareGame();
let submitterNonce = BigInt(await provider.getNonceForAddress(sequencer.address, "latest"));
const client = await connectClient();
setBlockTimestampSource(() => timestamp);
await runMeasuredSlice(
  {
    client,
    players,
    homes: [1, 2],
    time: () => confirmedTimestamp,
    prepareExplore: discovery.prepare,
    claim: () =>
      client.setup.network.provider.executeAndCheckTransaction(players[0], {
        contractAddress: manifest.world.address,
        entrypoint: "claim_production",
        calldata: [1],
      }),
    explore: (bot, explorerId, direction) =>
      client.setup.systemCalls.explorer_explore({
        signer: players[bot],
        explorer_id: explorerId,
        directions: [direction],
      }),
  },
  provider,
  evidence,
  resolve(lab, `native-slice-${gameId}.json`),
  {
    provenance,
    gameId,
    world: manifest.world.address,
    rulesRevision: preset.rulesRevision,
    poolOverrides: false,
    parityPassed: parity.passed,
    setupTransactions,
    roots,
  },
);

function call(domain: string, entrypoint: string, args: RawArgs): Call {
  return {
    contractAddress: manifest.native.domains[domain].address,
    entrypoint,
    calldata: new CallData(artifacts[domain].abi).compile(entrypoint, args),
  };
}
async function provision(domain: string, entrypoint: string, args: RawArgs) {
  const tx = await admin.execute(call(domain, entrypoint, args), { tip: 0, resourceBounds });
  await waitForSuccess(admin, tx.transaction_hash);
  setupTransactions.push(tx.transaction_hash);
}
async function prepareGame() {
  await provision("season", "create_game", {
    game_id: gameId,
    game: {
      name: "0x6e61746976655f736c696365",
      series_id: 0,
      game_number_in_series: 0,
      preset_id: 1,
      creator: admin.address,
      status: new CairoCustomEnum({ Live: {} }),
      dev_mode_on: true,
      start_settling_at: timestamp - 10000,
      start_main_at: timestamp - 10000,
      end_at: timestamp + 86400,
      end_grace_seconds: 0,
      registration_grace_seconds: 0,
      final_trial_id: 0,
      seed: 1,
    },
    rules: preset.rules,
  });
  await provision("season", "configure_upgrades", { game_id: gameId, limits: preset.oraclePreset.presetConfig.structure_max_level_config, recipes: upgradeRecipes(preset.oraclePreset.sideTables) });
  await provision("resources", "configure_resources", { game_id: gameId, rules: preset.resources });
  for (let bot = 0; bot < 2; bot++)
    await provision("structures", "provision_realm", {
      game_id: gameId,
      actor: players[bot].address,
      coord: { alt: false, x: 2147483626 + bot * 3, y: 2147483626 },
      grants: [
        [26, "1000000000000"],
        [35, "5000000000000"],
        [36, "5000000000000"],
        [38, "500000000000"],
        [23, "500000000000"],
      ],
    });
  await provision("structures", "provision_producer", {
    key: { game_id: gameId, entity_id: 1 },
    output: "300000000000",
  });
  await provision("structures", "provision_spire", {
    game_id: gameId,
    coord: { alt: false, x: 2147483628, y: 2147483627 },
  });
}

async function connectClient() {
  return createGameClient({
    world: buildWorldDeployment({
      id: "native",
      chain: "madara",
      manifest,
      heraldBaseUrl: "http://127.0.0.1:3004",
      rpcUrl,
      browserFacing: false,
      ...identity,
    }),
    gameId,
    presetId: 1,
    dojoConfig: { manifest, rpcUrl },
    setupEnvironment: { vrfProviderAddress: "0x0", executionResourceBounds: resourceBounds },
    socketFactory: evidence.socketFactory,
    scheduler: createMicrotaskGameSyncScheduler(),
    resolveGameConfig: () => getConfigFromNetwork("madara", "eternum"),
    observer: {
      ...evidence.observer,
      onHead: (head) => {
        timestamp = Math.max(timestamp, head.timestamp);
        if (!head.preconfirmed) confirmedTimestamp = head.timestamp;
      },
    },
    native: {
      bindings: bindings as unknown as NativeWorldBindings,
      chainId: await provider.getChainId(),
      signIntent: async (actor, digest) =>
        ec.starkCurve.sign(
          digest,
          records.find((record) => BigInt(record.address) === BigInt(actor.address))!.privateKey,
        ),
      executionContext: (command, actor) => {
        const input =
          command === "Explore" ? discovery.read() : { root: 1n, timestamp: confirmedTimestamp, outcome: "unused" };
        const raw = input.root;
        roots.push({ command, timestamp: input.timestamp, root: raw.toString(), desired: input.outcome });
        const record = records.find((record) => BigInt(record.address) === BigInt(actor.address));
        if (!record) throw new Error("Unknown fixture gameplay account");
        return {
          rawRoot: raw,
          timestamp: input.timestamp,
          authorityEpoch: 1,
          acceptedPublicKey: ec.starkCurve.getStarkKey(record.privateKey),
          l2Gas: BigInt(resourceBounds.l2_gas.max_amount),
        };
      },
      submit: async (call) => {
        const transaction = await sequencer.execute(call, { tip: 0, resourceBounds, nonce: submitterNonce });
        submitterNonce++;
        return transaction;
      },
    },
  });
}
