#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CallData,
  CairoCustomEnum,
  CairoOption,
  CairoOptionVariant,
  ec,
  hash,
  RpcProvider,
  type Account,
} from "starknet";
import { assertProviderChain } from "../../packages/chain/chain-guard.js";
import { declareClass, readClassArtifact, waitForSuccess } from "../../config/deployer/clean/shared/declare";
import { createMadaraAccount } from "../../config/deployer/clean/shared/madara-account";
import { fixtureAdmin } from "./fixture-admin";
import { loadEnvironmentConfiguration } from "../../config/deployer/clean/config/config-loader";
import { buildNativePreset } from "../../config/deployer/clean/config/native-preset";
import {
  buildNativePresetRegistration,
  registerNativePreset,
} from "../../config/deployer/clean/registrar/native-preset";
import { nativeDomainAbi } from "../../config/deployer/clean/world/native/manifest";
import type { NativeWorldManifest } from "../../config/deployer/clean/world/native/types";

const RPC = "http://127.0.0.1:15050/rpc/v0_9_0";
// Public local fixture credentials, independent of entropy generation.
const SEQUENCER_KEY = "0xd431";
const PLAYER_KEY = "0x3039";
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

function artifact(source: string, packageName: string, contract: string) {
  const prefix = resolve(source, `contracts/l3/${packageName}/target/dev/${contract}`);
  return readClassArtifact(`${prefix}.contract_class.json`, `${prefix}.compiled_contract_class.json`);
}

async function deploy(account: Account, compiled: ReturnType<typeof readClassArtifact>, args: string[], salt: string) {
  await declareClass(account, compiled, (transactionHash) => {
    console.log(JSON.stringify({ stage: "declared", classHash: compiled.classHash, transactionHash }));
  });
  const transaction = await account.deployContract(
    { classHash: compiled.classHash, salt, unique: false, constructorCalldata: args },
    { tip: 0 },
  );
  await waitForSuccess(account, transaction.transaction_hash);
  const address = hash.calculateContractAddressFromHash(salt, compiled.classHash, args, 0);
  if (BigInt(await account.getClassHashAt(address)) !== BigInt(compiled.classHash))
    throw new Error("Deployed class mismatch");
  return { address, classHash: compiled.classHash, transactionHash: transaction.transaction_hash };
}

async function createGame(manifestPath: string, manifest: NativeWorldManifest, admin: Account, count: number) {
  const config = loadEnvironmentConfiguration("madara.eternum");
  // The local fixture uses its funded token for bridge and faith exercises.
  config.faith!.reward_token = STRK;
  config.setup!.addresses.resources = { Stone: [2, STRK] };
  config.setup!.addresses.lords = STRK;
  const definition = buildNativePreset(config);
  const registration = buildNativePresetRegistration(config, 1, manifestPath);
  const registered = await registerNativePreset(admin, 1, registration);
  const codec = new CallData(nativeDomainAbi(manifest, "registry"));
  const timestamp = (await admin.getBlock("latest")).timestamp;
  const [gameId] = await admin.callContract({
    contractAddress: registration.address,
    entrypoint: "next_game_id",
  });
  const transaction = await admin.execute(
    {
      contractAddress: registration.address,
      entrypoint: "create_game",
      calldata: codec.compile("create_game", {
        params: {
          name: "0x72616e646f6d6e657373",
          preset_id: 1,
          series_id: 0,
          game_number_in_series: 0,
          start_settling_at: timestamp,
          start_main_at: timestamp,
          duration_seconds: 86400,
          end_grace_seconds: 86400,
          dev_mode_on: true,
          mode: new CairoCustomEnum({ Single: {} }),
          registration_limit: 0,
          registration_start: timestamp - 1,
          biome_climate: definition.rules.biome_climate_config,
          map_override: new CairoOption(CairoOptionVariant.None),
          seed: 1,
        },
        definition,
      }),
    },
    { tip: 0 },
  );
  await waitForSuccess(admin, transaction.transaction_hash);
  return {
    gameId,
    transactions: [registered, transaction.transaction_hash].filter((value) => value !== null),
    layers: Array.from({ length: count }, (_, index) => (index % 2 === 1 ? "ethereal" : "surface")),
    realmCount: count,
    realmIds: [] as number[],
  };
}

async function main() {
  const [destination, fixtureId, nativeSource, countText, primary, witness] = process.argv.slice(2);
  if (!destination || !nativeSource || !/^[1-9][0-9]{0,8}$/.test(fixtureId ?? ""))
    throw new Error("usage: deploy-fixture.ts OUTPUT_DIRECTORY FIXTURE_ID NATIVE_SOURCE REALM_COUNT PRIMARY WITNESS");
  if (
    ![
      ["journal-standby", "journal-replacement"],
      ["journal-replacement", "journal-successor"],
      ["journal-successor", "journal-witness"],
    ].some(([p, w]) => p === primary && w === witness)
  )
    throw new Error("Expected the retained journal pair");
  const count = Number(countText);
  if (!Number.isSafeInteger(count) || count < 1 || count > 1024) throw new Error("Realm count must be 1..1024");
  const source = resolve(nativeSource);
  if (execFileSync("git", ["status", "--porcelain"], { cwd: source, encoding: "utf8" }).trim())
    throw new Error("Native release source must be clean");
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
  const output = resolve(destination);
  if (existsSync(resolve(output, "fixture.json"))) throw new Error("Fixture exists; preserve its accepted stream");
  mkdirSync(output, { recursive: true });
  const provider = new RpcProvider({ nodeUrl: RPC });
  await assertProviderChain(provider, "madara", "isolated native fixture RPC");
  const admin = fixtureAdmin(provider);
  const authority = await deploy(
    admin,
    artifact(source, "world-native", "world_native_SequencingAccount"),
    [admin.address, ec.starkCurve.getStarkKey(SEQUENCER_KEY)],
    fixtureId,
  );
  const registry = await deploy(
    admin,
    artifact(source, "player-account", "realms_player_account_PlayerRegistry"),
    [admin.address],
    fixtureId,
  );
  const player = await deploy(
    admin,
    artifact(source, "player-account", "realms_player_account_RealmsPlayerAccount"),
    [ec.starkCurve.getStarkKey(PLAYER_KEY), admin.address, admin.address],
    fixtureId,
  );
  const bound = await admin.execute(
    [
      { contractAddress: registry.address, entrypoint: "bind", calldata: [admin.address, player.address] },
      { contractAddress: STRK, entrypoint: "transfer", calldata: [player.address, "1000000000000000000", "0"] },
    ],
    { tip: 0 },
  );
  await waitForSuccess(admin, bound.transaction_hash);
  const identity = resolve(output, "identity.json");
  writeFileSync(
    identity,
    JSON.stringify({ playerRegistryAddress: registry.address, playerAccountClassHash: player.classHash }),
  );
  const nativeManifest = resolve(output, "native-manifest.json");
  const schema = JSON.parse(readFileSync(resolve(source, "contracts/l3/world-native/schema/schema.json"), "utf8"));
  // The gameplay account administers this development fixture; its account interface cannot declare classes.
  for (const domain of Object.values(schema.domains) as { contract: string }[]) {
    await declareClass(
      admin,
      artifact(source, "world-native", `world_native_${domain.contract}`),
      (transactionHash) => {
        console.log(JSON.stringify({ stage: "declared-domain", domain: domain.contract, transactionHash }));
      },
    );
  }
  const playerAccount = createMadaraAccount(provider, player.address, PLAYER_KEY);
  const deployment = JSON.parse(
    execFileSync(
      "bun",
      [
        "config/deployer/clean/cli/deploy-world.ts",
        "--profile",
        "native",
        "--seed",
        `randomness_native_${fixtureId}`,
        "--identity",
        identity,
        "--manifest",
        nativeManifest,
        "--world-address-file",
        resolve(output, "world-address"),
        "--submitter",
        authority.address,
        "--rpc-url",
        RPC,
      ],
      {
        cwd: source,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
        env: { ...process.env, DOJO_ACCOUNT_ADDRESS: player.address, DOJO_PRIVATE_KEY: PLAYER_KEY },
      },
    ),
  );
  const manifest = JSON.parse(readFileSync(nativeManifest, "utf8"));
  const execution = { address: manifest.world.address, classHash: manifest.native.domains.season.initialClassHash };
  const configured = await admin.execute(
    [
      { contractAddress: authority.address, entrypoint: "configure", calldata: [execution.address] },
      { contractAddress: STRK, entrypoint: "transfer", calldata: [authority.address, "1000000000000000000", "0"] },
    ],
    { tip: 0 },
  );
  await waitForSuccess(admin, configured.transaction_hash);
  const game = await createGame(nativeManifest, manifest, playerAccount, count);
  const fixture = {
    schema: 1,
    fixtureId,
    scope: "native explore through recorded execution",
    rpc: RPC,
    chain: await provider.getChainId(),
    authority,
    execution,
    actor: player.address,
    owner: admin.address,
    game: game.gameId,
    playerPublicKey: ec.starkCurve.getStarkKey(PLAYER_KEY),
    nativeSource: source,
    nativeRevision: revision,
    registry,
    player,
    provision: game,
    configuredTransaction: configured.transaction_hash,
  };
  const nativeSchema = readFileSync(resolve(source, "contracts/l3/world-native/schema/schema.json"), "utf8");
  writeFileSync(resolve(output, "native-schema.json"), nativeSchema, { flag: "wx" });
  writeFileSync(resolve(output, "fixture.json"), JSON.stringify(fixture, null, 2) + "\n", { flag: "wx" });
  writeFileSync(resolve(output, "deploy.json"), JSON.stringify(deployment, null, 2) + "\n", { flag: "wx" });
  writeFileSync(
    resolve(output, "service.env"),
    [
      `RANDOMNESS_ACCOUNT=${authority.address}`,
      `RANDOMNESS_DEPLOYMENT=${execution.address}`,
      "RANDOMNESS_EPOCH=1",
      "RANDOMNESS_PLACEMENT=sidecar",
      `RANDOMNESS_SCHEMA_HOST_PATH=${resolve(output, "native-schema.json")}`,
      "RANDOMNESS_L2_RPC_URL=http://madara:9944",
      `RANDOMNESS_PRIVATE_KEY=${SEQUENCER_KEY}`,
      `RANDOMNESS_JOURNAL_PRIMARY=host=${primary} dbname=randomness_execution_${fixtureId} user=randomness_writer_1 password=local-rehearsal`,
      `RANDOMNESS_JOURNAL_STANDBY=host=${witness} dbname=randomness_execution_${fixtureId} user=randomness_writer_1 password=local-rehearsal`,
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log(JSON.stringify(fixture));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
