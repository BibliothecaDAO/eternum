#!/usr/bin/env bun
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { CallData, CairoOption, RpcProvider } from "starknet";
import { admissionFor, commandArguments, readFixture, signedRequest } from "./native-intent";

const path = process.argv[2];
if (!path) throw new Error("usage: prepare-native-actions.ts FIXTURE_JSON");
const fixture = readFixture(path);
assert(!fixture.explorers, "Explorer preparation already completed");
const provider = new RpcProvider({ nodeUrl: fixture.rpc });
const manifest = JSON.parse(readFileSync(resolve(dirname(path), "native-manifest.json"), "utf8"));
const actions: { order: string; action: string; command: string }[] = [];

function domain(name: string, contract: string) {
  const artifact = JSON.parse(
    readFileSync(
      resolve(
        fixture.nativeSource,
        `contracts/l3/world-native/target/dev/world_native_${contract}.contract_class.json`,
      ),
      "utf8",
    ),
  );
  return { address: manifest.native.domains[name].address as string, codec: new CallData(artifact.abi) };
}
const structures = domain("structures", "StructuresDomain");
const troops = domain("troops", "TroopsDomain");

async function existingExplorer(realm: number) {
  const values = await provider.callContract(
    { contractAddress: structures.address, entrypoint: "structure", calldata: [fixture.game, String(realm)] },
    "pre_confirmed",
  );
  const home = (structures.codec.parse("structure", values) as CairoOption<{ troop_explorers: bigint[] }>).unwrap();
  assert(home, "Provisioned realm missing");
  assert(home.troop_explorers.length <= 1, "Unexpected fixture explorer count");
  return home.troop_explorers.length ? Number(home.troop_explorers[0]) : undefined;
}

async function isEthereal(explorer: number) {
  const values = await provider.callContract(
    { contractAddress: troops.address, entrypoint: "explorer", calldata: [fixture.game, String(explorer)] },
    "pre_confirmed",
  );
  const row = (troops.codec.parse("explorer", values) as CairoOption<{ coord: { alt: boolean } }>).unwrap();
  assert(row, "Prepared explorer missing");
  return row.coord.alt;
}

async function execute(command: string, args: object) {
  const admission = await admissionFor(provider, fixture);
  const { action, ...request } = signedRequest(fixture, admission, commandArguments(fixture, command, args));
  const response = await fetch("http://127.0.0.1:15081/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const accepted = await response.json();
  assert.equal(BigInt(accepted.action), BigInt(action));
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const result = await provider.callContract(
      { contractAddress: fixture.execution.address, entrypoint: "get_result", calldata: [admission[4]] },
      "pre_confirmed",
    );
    if (BigInt(result[0]) !== 0n) {
      assert.equal(BigInt(result[0]), 1n, `${command} rejected; preserve ticket`);
      actions.push({ action, order: admission[4], command });
      return;
    }
    await sleep(20);
  }
  throw new Error("Preparation remains pending; recover its existing ticket before continuing");
}

const explorers: number[] = [];
for (const realm of fixture.provision.realmIds) {
  let explorer = await existingExplorer(realm);
  if (explorer === undefined) {
    await execute("CreateExplorer", { structure_id: realm, category: 0, tier: 0, amount: "1000000000", direction: 0 });
    explorer = await existingExplorer(realm);
    assert(explorer !== undefined, "Successful creation did not produce an explorer");
  }
  const index = explorers.length;
  if (fixture.provision.layers?.[index] === "ethereal" && !(await isEthereal(explorer))) {
    await execute("ToggleAlternate", { explorer_id: explorer, spire_direction: 2 });
    assert(await isEthereal(explorer), "Alternate entry did not change layer");
  }
  explorers.push(explorer);
  console.log(JSON.stringify({ prepared: explorers.length, total: fixture.provision.realmIds.length, explorer }));
}
fixture.explorers = explorers;
fixture.firstExploreNonce = (await admissionFor(provider, fixture))[3];
writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
writeFileSync(resolve(dirname(path), "prepared-actions.json"), JSON.stringify(actions, null, 2) + "\n", { flag: "wx" });
