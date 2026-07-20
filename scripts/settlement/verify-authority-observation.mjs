import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "starknet";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const observation = readJson("packages/settlement-codec/schema/onchain-observation-a20-v1.json");

await verifyFinalizedBlock();
await verifyDeploymentBoundary();
await verifyObservedClasses();
await verifyMutableEntrypoints();
await verifyCompleteRoleHistory();

console.log(
  JSON.stringify({
    blockNumber: observation.blockNumber,
    classHash: observation.classHash,
    contractAddress: observation.contractAddress,
    result: "verified",
    roleEventCount: observation.roleEventCount,
  }),
);

async function verifyFinalizedBlock() {
  const block = await rpcResult("starknet_getBlockWithTxHashes", [{ block_number: observation.blockNumber }]);
  assertEqual(block.block_hash, observation.blockHash, "finalized block hash");
  assertEqual(block.new_root, observation.stateRoot, "finalized state root");
  assertEqual(block.status, observation.blockStatus, "finalized block status");
}

async function verifyObservedClasses() {
  const blockId = { block_number: observation.blockNumber };
  const classHash = await rpcResult("starknet_getClassHashAt", [blockId, observation.contractAddress]);
  assertEqual(classHash, observation.classHash, "MMR token class hash");

  for (const controller of observation.controllers) {
    const controllerClassHash = await rpcResult("starknet_getClassHashAt", [blockId, controller.address]);
    assertEqual(controllerClassHash, controller.classHash, `controller class hash ${controller.address}`);
    const responseText = await rpcResponseText("starknet_getClass", [blockId, controller.classHash]);
    assertEqual(
      sha256(responseText),
      controller.classResponseSha256,
      `controller class response ${controller.address}`,
    );
    const response = JSON.parse(responseText);
    if (response.error) throw new Error(`controller starknet_getClass failed: ${JSON.stringify(response.error)}`);
    const abi = typeof response.result.abi === "string" ? JSON.parse(response.result.abi) : response.result.abi;
    const entrypoints = collectExternalEntrypoints(abi);
    if (!entrypoints.includes(controller.executionEntrypoint)) {
      throw new Error(`controller execution entrypoint missing: ${controller.address}`);
    }
    assertEqual(
      hash.getSelectorFromName(controller.executionEntrypoint),
      controller.executionSelector,
      `controller execution selector ${controller.address}`,
    );
  }
}

async function verifyDeploymentBoundary() {
  let lower = 0;
  let upper = observation.blockNumber;
  while (lower < upper) {
    const midpoint = Math.floor((lower + upper) / 2);
    if (await contractExistsAt(midpoint)) upper = midpoint;
    else lower = midpoint + 1;
  }
  assertEqual(lower, observation.deploymentBlockNumber, "MMR deployment block");
}

async function contractExistsAt(blockNumber) {
  const response = JSON.parse(
    await rpcResponseText("starknet_getClassHashAt", [{ block_number: blockNumber }, observation.contractAddress]),
  );
  if (!response.error) return true;
  if (response.error.code === 20 || /contract not found/i.test(response.error.message ?? "")) return false;
  throw new Error(`starknet_getClassHashAt failed: ${JSON.stringify(response.error)}`);
}

async function verifyMutableEntrypoints() {
  const responseText = await rpcResponseText("starknet_getClass", [
    { block_number: observation.blockNumber },
    observation.classHash,
  ]);
  assertEqual(sha256(responseText), observation.classResponseSha256, "MMR class response SHA-256");

  const response = JSON.parse(responseText);
  if (response.error) throw new Error(`starknet_getClass failed: ${JSON.stringify(response.error)}`);
  const mutableEntrypoints = collectExternalEntrypoints(JSON.parse(response.result.abi));
  const expected = observation.mutableEntrypoints.map(({ name }) => name).sort();
  assertJsonEqual(mutableEntrypoints, expected, "mutable MMR ABI entrypoints");
  for (const entrypoint of observation.mutableEntrypoints) {
    assertEqual(hash.getSelectorFromName(entrypoint.name), entrypoint.selector, `selector ${entrypoint.name}`);
  }
}

async function verifyCompleteRoleHistory() {
  const events = await loadAllContractEvents();
  const roleSelectors = new Map([
    [hash.getSelectorFromName("RoleGranted"), "RoleGranted"],
    [hash.getSelectorFromName("RoleRevoked"), "RoleRevoked"],
    [hash.getSelectorFromName("RoleAdminChanged"), "RoleAdminChanged"],
  ]);
  const roleEvents = events
    .filter(({ keys }) => roleSelectors.has(keys[0]))
    .map((event) => ({
      blockNumber: event.block_number,
      transactionHash: event.transaction_hash,
      eventIndex: event.event_index,
      event: roleSelectors.get(event.keys[0]),
      roleId: event.data[0],
      account: event.data[1],
      sender: event.data[2],
    }));
  assertJsonEqual(roleEvents, observation.roleEvents, "complete MMR role event history");
  await verifyObservedRoleState(roleEvents);
}

async function verifyObservedRoleState(roleEvents) {
  const membersByRole = new Map();
  for (const event of roleEvents) {
    if (event.event === "RoleAdminChanged") continue;
    const roleId = normalizeFelt(event.roleId);
    const members = membersByRole.get(roleId) ?? new Set();
    if (event.event === "RoleGranted") members.add(normalizeFelt(event.account));
    if (event.event === "RoleRevoked") members.delete(normalizeFelt(event.account));
    membersByRole.set(roleId, members);
  }

  for (const role of observation.roles) {
    const roleId = normalizeFelt(role.roleId);
    const observedMembers = [...(membersByRole.get(roleId) ?? new Set())].sort(compareFelts);
    const expectedMembers = role.members.map(normalizeFelt).sort(compareFelts);
    assertJsonEqual(observedMembers, expectedMembers, `role members ${role.name}`);

    const adminRoleResult = await rpcResult("starknet_call", [
      {
        contract_address: observation.contractAddress,
        entry_point_selector: hash.getSelectorFromName("get_role_admin"),
        calldata: [role.roleId],
      },
      { block_number: observation.blockNumber },
    ]);
    assertEqual(normalizeFelt(adminRoleResult[0]), normalizeFelt(role.adminRoleId), `admin role ${role.name}`);
  }
}

async function loadAllContractEvents() {
  const events = [];
  let continuationToken;
  do {
    const filter = {
      from_block: { block_number: observation.deploymentBlockNumber },
      to_block: { block_number: observation.blockNumber },
      address: observation.contractAddress,
      chunk_size: 1000,
      ...(continuationToken ? { continuation_token: continuationToken } : {}),
    };
    const page = await rpcResult("starknet_getEvents", [filter]);
    events.push(...page.events);
    continuationToken = page.continuation_token;
  } while (continuationToken);
  return events;
}

function collectExternalEntrypoints(abi) {
  const names = [];
  visit(abi);
  return names.sort();

  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "function" && value.state_mutability === "external") names.push(value.name);
    Object.values(value).forEach(visit);
  }
}

async function rpcResult(method, params) {
  const response = JSON.parse(await rpcResponseText(method, params));
  if (response.error) throw new Error(`${method} failed: ${JSON.stringify(response.error)}`);
  return response.result;
}

async function rpcResponseText(method, params) {
  const response = await fetch(observation.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  return response.text();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
}

function assertJsonEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} mismatch`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeFelt(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function compareFelts(left, right) {
  return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8"));
}
