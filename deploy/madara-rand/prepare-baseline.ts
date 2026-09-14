#!/usr/bin/env bun
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { CallData, CairoCustomEnum, RpcProvider, type Call, type RawArgs } from "starknet";
import { fixtureAdmin } from "./fixture-admin";
import { createMadaraAccount } from "../../config/deployer/clean/shared/madara-account";
import { declareClass, readClassArtifact, waitForSuccess } from "../../config/deployer/clean/shared/declare";
import { resourceSelector, byteArrayHash } from "../../config/deployer/clean/world/artifacts";
import { bootstrapChainConfig, createRegistrarGame, registerPreset } from "../../config/deployer/clean/registrar/calls";
import {
  buildChainConfig,
  buildCreateGameParams,
  buildPresetRegistration,
} from "../../config/deployer/clean/registrar/preset";
import { getConfigFromNetwork } from "../../config/utils/utils";

const [manifestPath, nativeFixturePath, nativeSource, output, countText, artifactsPath] = process.argv.slice(2);
if (!manifestPath || !nativeFixturePath || !nativeSource || !output)
  throw new Error(
    "usage: prepare-baseline.ts DOJO_MANIFEST NATIVE_FIXTURE NATIVE_SOURCE OUTPUT_JSON REALM_COUNT ARTIFACTS",
  );
const count = Number(countText);
assert(Number.isSafeInteger(count) && count > 0 && count <= 1024);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const fixture = JSON.parse(readFileSync(nativeFixturePath, "utf8"));
assert.equal(fixture.rpc, "http://127.0.0.1:15050/rpc/v0_9_0");
const provider = new RpcProvider({ nodeUrl: fixture.rpc });
const admin = fixtureAdmin(provider);
const player = createMadaraAccount(provider, fixture.actor, "0x3039");
const worldCodec = new CallData(manifest.world.abi);
const prefix = resolve(
  nativeSource,
  "deploy/madara-lab/.lab/native-oracle/contracts/l3/game/target/dev/eternum_lab_slice_systems",
);
const artifact = readClassArtifact(`${prefix}.contract_class.json`, `${prefix}.compiled_contract_class.json`);
const fixtureCodec = new CallData(artifact.sierra.abi);
const transactions: { action: string; hash: string }[] = [];
const world = (entrypoint: string, args: RawArgs): Call => ({
  contractAddress: manifest.world.address,
  entrypoint,
  calldata: worldCodec.compile(entrypoint, args),
});
async function send(action: string, calls: Call | Call[], account = admin) {
  const transaction = await account.execute(calls, { tip: 0 });
  await waitForSuccess(account, transaction.transaction_hash);
  transactions.push({ action, hash: transaction.transaction_hash });
}

await declareClass(admin, artifact, (hash) => transactions.push({ action: "declare_fixture", hash }));
const selector = resourceSelector("s2", "lab_slice_systems");
await send(
  "register_fixture",
  world("register_contract", { namespace: "s2", salt: selector, class_hash: artifact.classHash }),
);
const resource = await provider.callContract(world("resource", { selector }), "latest");
assert.equal(Number(resource[0]), 2);
const helperAddress = resource[1];
await send("grant_fixture", world("grant_writer", { resource: byteArrayHash("s2"), contract: helperAddress }));
await send("initialize_fixture", world("init_contract", { selector, init_calldata: [] }));
const call = (entrypoint: string, args: RawArgs): Call => ({
  contractAddress: helperAddress,
  entrypoint,
  calldata: fixtureCodec.compile(entrypoint, args),
});
const config = getConfigFromNetwork("madara", "eternum");
const chain = await bootstrapChainConfig(
  admin,
  buildChainConfig(config, {
    adminAddress: admin.address,
    ledgerOperatorAddress: "0x0",
    playerRegistryAddress: fixture.registry.address,
    vrfProviderAddress: "0x0",
    agentControllerAddress: "0x0",
    cosmeticsAddress: "0x0",
    timelockAddress: "0x0",
    lootChestAddress: "0x0",
    eliteNftAddress: "0x0",
  }),
  manifest,
);
transactions.push({ action: "chain_config", hash: chain.transactionHash });
const preset = await registerPreset(admin, buildPresetRegistration(config, 1), manifest);
transactions.push({ action: "preset", hash: preset.transactionHash });
let gameId = 0;
for (let index = 1; index <= 7; index++) {
  const now = (await provider.getBlock("latest")).timestamp;
  const params = buildCreateGameParams(config, {
    gameName: `baseline_${index}`,
    presetId: 1,
    startMainAt: now - 10000,
    durationSeconds: 86400,
    devModeOn: true,
    singleRealmMode: false,
    twoPlayerMode: false,
    useMapOverride: false,
  });
  params.seed = 1;
  const game = await createRegistrarGame(admin, params, manifest);
  assert.equal(game.gameId, index, "Unexpected fresh game sequence");
  gameId = index;
  transactions.push({ action: "game", hash: game.transactionHash });
}
for (let start = 0; start < count; start += 8) {
  await send(
    "realms",
    Array.from({ length: Math.min(8, count - start) }, (_, offset) =>
      call("bootstrap", {
        game_id: gameId,
        actor: fixture.actor,
        coord: { alt: false, x: 2147483626 + (start + offset) * 20, y: 2147483626 },
        grants: [
          [26, "1000000000000"],
          [35, "5000000000000"],
          [36, "5000000000000"],
          [38, "100000000000"],
        ],
      }),
    ),
  );
}
for (let start = 1; start < count; start += 16) {
  await send(
    "spires",
    Array.from({ length: Math.min(8, Math.ceil((count - start) / 2)) }, (_, offset) =>
      call("spire", {
        game_id: gameId,
        coord: { alt: false, x: 2147483627 + (start + offset * 2) * 20, y: 2147483627 },
      }),
    ),
  );
}

async function rows(model: string) {
  const response = await fetch(`http://127.0.0.1:13005/madara/games/${gameId}/snapshot?models=${model}`, {
    signal: AbortSignal.timeout(10000),
  });
  assert(response.ok, `Baseline Herald lookup failed: ${response.status}`);
  const snapshot = await response.json();
  return snapshot.models[0].rows as { value: Record<string, any> }[];
}
async function waitRows(model: string, expected: number) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const found = await rows(model);
    if (found.length >= expected) return found;
    await sleep(100);
  }
  throw new Error(`Baseline Herald did not reconstruct ${expected} ${model} rows`);
}
const homes = (await waitRows("Structure", count))
  .map((row) => row.value)
  .filter((row) => BigInt(row.owner) === BigInt(fixture.actor))
  .sort((left, right) => Number(BigInt(left.base.coord_x) - BigInt(right.base.coord_x)));
assert.equal(homes.length, count);
const realmIds = homes.map((row) => Number(BigInt(row.entity_id)));
const contract = (name: string) => {
  const found = manifest.contracts.find((entry: { tag: string }) => entry.tag === `s2-${name}`);
  assert(found, `Missing baseline ${name}`);
  return {
    ...found,
    abi: JSON.parse(readFileSync(resolve(artifactsPath, `eternum_${name}.contract_class.json`), "utf8")).abi,
  };
};
const create = contract("troop_management_systems");
const travel = contract("alt_movement_systems");
const createCodec = new CallData(create.abi);
for (let start = 0; start < count; start += 8) {
  await send(
    "explorers",
    realmIds
      .slice(start, start + 8)
      .map((realm) => ({
        contractAddress: create.address,
        entrypoint: "explorer_create",
        calldata: createCodec.compile("explorer_create", {
          game_id: gameId,
          for_structure_id: realm,
          category: new CairoCustomEnum({ Knight: {} }),
          tier: new CairoCustomEnum({ T1: {} }),
          amount: "1000000000",
          spawn_direction: new CairoCustomEnum({ East: {} }),
        }),
      })),
    player,
  );
}
const byHome = new Map(
  (await waitRows("ExplorerTroops", count)).map((row) => [
    Number(BigInt(row.value.owner)),
    Number(BigInt(row.value.explorer_id)),
  ]),
);
const explorers = realmIds.map((realm) => {
  const id = byHome.get(realm);
  assert(id !== undefined);
  return id;
});
const travelCodec = new CallData(travel.abi);
for (let start = 1; start < count; start += 16) {
  await send(
    "ethereal_entry",
    Array.from({ length: Math.min(8, Math.ceil((count - start) / 2)) }, (_, offset) => ({
      contractAddress: travel.address,
      entrypoint: "toggle_alternate",
      calldata: travelCodec.compile("toggle_alternate", {
        game_id: gameId,
        explorer_id: explorers[start + offset * 2],
        spire_direction: new CairoCustomEnum({ NorthWest: {} }),
      }),
    })),
    player,
  );
}
writeFileSync(
  output,
  JSON.stringify(
    {
      schema: 1,
      rpc: fixture.rpc,
      world: manifest.world.address,
      game: gameId,
      actor: fixture.actor,
      artifactsPath,
      realmIds,
      explorers,
      layers: explorers.map((_, index) => (index % 2 ? "ethereal" : "surface")),
      manifestPath,
      source: "unchanged pinned Dojo exploration; the current zero-provider transaction-hash placeholder is retained",
      transactions,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
