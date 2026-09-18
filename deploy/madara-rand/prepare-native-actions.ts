#!/usr/bin/env bun
import type { NativeCommand } from "../../packages/provider/src/native-command";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CallData, RpcProvider } from "starknet";
import { createMadaraAccount } from "../../config/deployer/clean/shared/madara-account";
import { waitForSuccess } from "../../config/deployer/clean/shared/declare";
import { nativeDomainAbi } from "../../config/deployer/clean/world/native/manifest";
import { admissionFor, commandArguments, readFixture, signedRequest, waitForOutcome } from "./native-intent";

type Scalar = string | number;
type Coord = { alt: boolean; x: Scalar; y: Scalar };
type Home = {
  entity_id: Scalar;
  owner: Scalar;
  metadata: { realm_id: Scalar };
  troop_explorers: Scalar[];
  base: { coord_x: Scalar; coord_y: Scalar };
};
type Explorer = { explorer_id: Scalar; coord: Coord };
type Tile = { alt: boolean; col: Scalar; row: Scalar; data: Scalar };

const path = process.argv[2];
if (!path) throw new Error("usage: prepare-native-actions.ts FIXTURE_JSON");
const fixture = readFixture(path);
assert(!fixture.explorers, "Explorer preparation already completed");
assert(fixture.owner && fixture.provision.realmCount, "Expected a full native fixture");
const provider = new RpcProvider({ nodeUrl: fixture.rpc });
const manifest = JSON.parse(readFileSync(resolve(dirname(path), "native-manifest.json"), "utf8"));
const administrator = createMadaraAccount(provider, fixture.actor, "0x3039");
const structures = {
  address: manifest.native.domains.structures.address,
  codec: new CallData(nativeDomainAbi(manifest, "structures")),
};
const actionsPath = resolve(dirname(path), "prepared-actions.json");
const actions: { order: string; action: string; command: string }[] = (() => {
  try {
    return JSON.parse(readFileSync(actionsPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
})();

async function rows<T>(model: string): Promise<T[]> {
  const response = await fetch(`http://127.0.0.1:13003/madara/games/${BigInt(fixture.game)}/snapshot?models=${model}`, {
    signal: AbortSignal.timeout(10000),
  });
  assert(response.ok, `Herald ${model} snapshot failed: ${response.status}`);
  const snapshot = await response.json();
  const collection = snapshot.models.find((entry: { model: string }) => entry.model === model);
  assert(collection, `Herald omitted ${model}`);
  return collection.rows.map((row: { value: T }) => row.value);
}

async function home(realm: number) {
  const found = (await rows<Home>("Structure")).find((row) => Number(row.metadata.realm_id) === realm);
  if (found) assert.equal(BigInt(found.owner), BigInt(fixture.actor), "Prepared realm changed ownership");
  return found;
}

async function explorer(id: number) {
  const found = (await rows<Explorer>("ExplorerTroops")).find((row) => Number(row.explorer_id) === id);
  assert(found, "Prepared explorer missing from Herald");
  return found;
}

async function execute(command: NativeCommand) {
  const admission = await admissionFor(provider, fixture);
  const { action, ...request } = signedRequest(fixture, admission, commandArguments(fixture, command));
  const response = await fetch("http://127.0.0.1:15081/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const accepted = await response.json();
  assert.equal(BigInt(accepted.action), BigInt(action));
  const result = await waitForOutcome(provider, fixture, "http://127.0.0.1:15081/actions", action);
  actions.push({ action, order: result.order, command: command.kind });
  writeFileSync(actionsPath, JSON.stringify(actions, null, 2) + "\n");
  assert.equal(BigInt(result.status), 1n, `${command.kind} rejected with ${result.reason}; preserve ticket`);
}

async function settle(realm: number) {
  let found = await home(realm);
  if (!found) {
    await execute({ kind: "SettleSeason", value: {
      name: "0x72656865617273616c",
      selected_realm: { kind: "Some", value: realm },
    } });
    found = await home(realm);
  }
  assert(found, "Successful settlement did not produce a realm");
  return found;
}

async function provisionResources(entity: number) {
  const balances = (
    await rows<{ entity_id: Scalar; resource_type: Scalar; balance: Scalar }>("ResourceBalance")
  ).filter((row) => Number(row.entity_id) === entity);
  const grants = [
    [26, 1000n],
    [35, 5000n],
    [36, 5000n],
    [38, 100n],
  ].flatMap(([resource, units]) => {
    const resource_type = Number(resource);
    const current = BigInt(balances.find((row) => Number(row.resource_type) === resource_type)?.balance ?? 0);
    const required = BigInt(units) * 1_000_000_000n;
    return current < required ? [{ resource_type, amount: (required - current).toString() }] : [];
  });
  if (grants.length) await execute({ kind: "MintDevelopmentResources", value: { entity_id: entity, resources: grants } });
}

function accessSpire(coord: Coord) {
  return { alt: false, x: Number(coord.x) - (Number(coord.y) % 2), y: Number(coord.y) + 1 };
}

async function provisionAccess(coord: Coord) {
  const spire = accessSpire(coord);
  const existing = (await rows<Tile>("TileOpt")).find(
    (tile) => !tile.alt && Number(tile.col) === spire.x && Number(tile.row) === spire.y,
  );
  if (existing && (BigInt(existing.data) / 2n) % 256n === 35n) return;
  const transaction = await administrator.execute(
    {
      contractAddress: structures.address,
      entrypoint: "provision_spire",
      calldata: structures.codec.compile("provision_spire", { game_id: fixture.game, coord: spire }),
    },
    { tip: 0 },
  );
  await waitForSuccess(administrator, transaction.transaction_hash);
}

const explorers: number[] = [];
fixture.geometry = [];
for (let index = 0; index < fixture.provision.realmCount; index++) {
  let settled = await settle(index + 1);
  const realm = Number(settled.entity_id);
  await provisionResources(realm);
  assert(settled.troop_explorers.length <= 1, "Unexpected fixture explorer count");
  if (!settled.troop_explorers.length) {
    await execute({ kind: "CreateExplorer", value: { structure_id: realm, category: 0, tier: 0, amount: "1000000000", direction: 0 } });
    const created = await home(index + 1);
    assert(created, "Prepared realm disappeared during explorer creation");
    settled = created;
  }
  const id = Number(settled.troop_explorers[0]);
  assert(Number.isSafeInteger(id), "Successful creation did not produce an explorer");
  const troop = await explorer(id);
  if (fixture.provision.layers?.[index] === "ethereal" && !troop.coord.alt) {
    await provisionAccess(troop.coord);
    await execute({ kind: "ToggleAlternate", value: { explorer_id: id, spire_direction: 2 } });
    assert((await explorer(id)).coord.alt, "Alternate entry did not change layer");
  }
  explorers.push(id);
  const prepared = await explorer(id);
  fixture.geometry.push({
    realm: { alt: false, x: Number(settled.base.coord_x), y: Number(settled.base.coord_y) },
    explorer: { alt: prepared.coord.alt, x: Number(prepared.coord.x), y: Number(prepared.coord.y) },
    ...(prepared.coord.alt ? { spire: accessSpire(prepared.coord) } : {}),
  });
  fixture.provision.realmIds[index] = realm;
  writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
  console.log(JSON.stringify({ prepared: explorers.length, total: fixture.provision.realmCount, explorer: id }));
}
fixture.explorers = explorers;
fixture.firstExploreNonce = (await admissionFor(provider, fixture))[3];
writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
