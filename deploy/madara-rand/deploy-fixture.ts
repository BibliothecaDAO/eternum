#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Abi, type Account, ec, hash, RpcProvider, shortString } from "starknet";
import { assertProviderChain } from "../../packages/chain/chain-guard.js";
import { declareClass, readClassArtifact, waitForSuccess } from "../../config/deployer/clean/shared/declare";
import { createMadaraAccount } from "../../config/deployer/clean/shared/madara-account";

const DIRECTORY = dirname(fileURLToPath(import.meta.url));
const RPC = "http://127.0.0.1:15050/rpc/v0_9_0";
const ADMIN = "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d";
const ADMIN_KEY = "0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07";
const SEQUENCER_KEY = "0xd431";
const PLAYER_KEY = "0x3039";
const ACTOR = "0x1c8";

function artifact(name: string) {
  const prefix = resolve(
    DIRECTORY,
    "../../contracts/l3/randomness-protocol/target/dev",
    `eternum_randomness_protocol_${name}`,
  );
  return readClassArtifact(`${prefix}.contract_class.json`, `${prefix}.compiled_contract_class.json`);
}

async function deploy(account: Account, name: string, constructorCalldata: string[], salt: string) {
  const compiled = artifact(name);
  await declareClass(account, compiled, (transactionHash) => {
    console.log(JSON.stringify({ stage: "declared", contract: name, transactionHash }));
  });
  const result = await account.deployContract(
    {
      classHash: compiled.classHash,
      salt,
      unique: false,
      constructorCalldata,
    },
    { tip: 0 },
  );
  await waitForSuccess(account, result.transaction_hash);
  const address = hash.calculateContractAddressFromHash(salt, compiled.classHash, constructorCalldata, "0x0");
  const deployedHash = await account.getClassHashAt(address);
  if (BigInt(deployedHash) !== BigInt(compiled.classHash)) throw new Error(`Unexpected deployed class for ${name}`);
  return {
    address,
    classHash: compiled.classHash,
    compiledClassHash: compiled.compiledClassHash,
    transactionHash: result.transaction_hash,
  };
}

function nativeManifest(execution: { address: string; classHash: string }, deploymentBlock: number) {
  const abi = artifact("RecordedExecutionStub").sierra.abi as Abi;
  const row = abi.find((item) => item.type === "event" && item.kind === "struct" && item.name.endsWith("::RowSet"));
  if (!row) throw new Error("Compiled fixture has no RowSet event");
  const schema = {
    version: 1,
    cairoVersion: "2.13.1",
    encoding: "cairo-serde",
    domains: {
      season: {
        contract: "RecordedExecutionStub",
        events: [{ name: "RowSet", prefix: [hash.getSelectorFromName("RowSet")], members: row.members }],
        entrypoints: abi
          .flatMap((item) => (item.type === "interface" ? item.items : [item]))
          .filter((item) => item.type === "function")
          .map((item) => ({ name: item.name, inputs: item.inputs })),
      },
    },
    models: [
      {
        name: "DomainClass",
        identity: shortString.encodeShortString("DomainClass"),
        owners: ["season"],
        scope: "deployment",
        emitterKey: "address",
        keys: [{ name: "address", type: "core::starknet::contract_address::ContractAddress" }],
        members: [{ name: "class_hash", type: "core::starknet::class_hash::ClassHash" }],
        keyLength: 1,
        valueLength: 1,
      },
      {
        name: "ActionNonce",
        identity: shortString.encodeShortString("ActionNonce"),
        owners: ["season"],
        scope: "game",
        keys: [
          { name: "game_id", type: "core::integer::u32" },
          { name: "actor", type: "core::starknet::contract_address::ContractAddress" },
        ],
        members: [{ name: "nonce", type: "core::integer::u64" }],
        keyLength: 2,
        valueLength: 1,
      },
    ],
    absentCollections: [],
    types: Object.fromEntries(
      abi.filter((item) => item.type === "struct" || item.type === "enum").map((item) => [item.name, item]),
    ),
    projections: [],
  };
  const identity = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
  return {
    world: { address: execution.address },
    models: [],
    events: [],
    native: {
      version: 1,
      deploymentBlock,
      activeSchema: identity,
      schemas: { [identity]: { ...schema, identity } },
      domains: {
        season: {
          address: execution.address,
          initialClassHash: execution.classHash,
          classes: { [execution.classHash]: identity },
        },
      },
    },
  };
}

async function main() {
  const destination = process.argv[2];
  const fixtureId = process.argv[3];
  if (!destination || !fixtureId || !/^[1-9][0-9]{0,8}$/.test(fixtureId))
    throw new Error("usage: bun deploy/madara-rand/deploy-fixture.ts OUTPUT_DIRECTORY FIXTURE_ID");
  const output = resolve(destination);
  if (existsSync(resolve(output, "fixture.json")))
    throw new Error("Fixture manifest already exists; preserve this deployment");
  const provider = new RpcProvider({ nodeUrl: RPC });
  await assertProviderChain(provider, "madara", "isolated fixture RPC");
  const admin = createMadaraAccount(provider, ADMIN, ADMIN_KEY);
  const authority = await deploy(
    admin,
    "SequencingAccount",
    [ADMIN, ec.starkCurve.getStarkKey(SEQUENCER_KEY)],
    fixtureId,
  );
  const execution = await deploy(
    admin,
    "RecordedExecutionStub",
    [authority.address, ACTOR, ec.starkCurve.getStarkKey(PLAYER_KEY)],
    fixtureId,
  );
  const configured = await admin.execute(
    [
      { contractAddress: authority.address, entrypoint: "configure", calldata: [execution.address] },
      {
        contractAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        entrypoint: "transfer",
        calldata: [authority.address, "1000000000000000000", "0x0"],
      },
    ],
    { tip: 0 },
  );
  await waitForSuccess(admin, configured.transaction_hash);
  const manifest = {
    schema: 1,
    fixtureId,
    scope: "deployed protocol conformance stub; not gameplay explore",
    rpc: RPC,
    chain: await provider.getChainId(),
    authority,
    execution,
    actor: ACTOR,
    game: "0x7",
    playerPublicKey: ec.starkCurve.getStarkKey(PLAYER_KEY),
    configuredTransaction: configured.transaction_hash,
  };
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "fixture.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  writeFileSync(
    resolve(output, "native-manifest.json"),
    `${JSON.stringify(nativeManifest(execution, await provider.getBlockNumber()), null, 2)}\n`,
    { flag: "wx" },
  );
  writeFileSync(
    resolve(output, "service.env"),
    [
      `RANDOMNESS_ACCOUNT=${authority.address}`,
      `RANDOMNESS_DEPLOYMENT=${execution.address}`,
      "RANDOMNESS_EPOCH=1",
      "RANDOMNESS_PLACEMENT=sidecar",
      `RANDOMNESS_PRIVATE_KEY=${SEQUENCER_KEY}`,
      `RANDOMNESS_JOURNAL_PRIMARY=host=journal-primary dbname=randomness_execution_${fixtureId} user=randomness_writer_1 password=local-rehearsal`,
      `RANDOMNESS_JOURNAL_STANDBY=host=journal-standby dbname=randomness_execution_${fixtureId} user=randomness_writer_1 password=local-rehearsal`,
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log(JSON.stringify(manifest));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
