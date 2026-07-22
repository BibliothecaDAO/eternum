import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "starknet";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const observation = readJson("packages/settlement-codec/schema/onchain-observation-a20-v1.json");

if (isDirectInvocation()) await verifyAuthorityObservation();

async function verifyAuthorityObservation() {
  await verifyChainIdentity();
  await verifyFinalizedBlock();
  await verifyFinalizedDeclaration();
  await verifyFinalizedDeployment();
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
}

async function verifyChainIdentity() {
  const chainId = await rpcResult("starknet_chainId", []);
  assertFeltEqual(chainId, observation.rpcChainId, "authority observation RPC chain");
}

async function verifyFinalizedBlock() {
  const block = await rpcResult("starknet_getBlockWithTxHashes", [{ block_number: observation.blockNumber }]);
  assertEqual(block.block_hash, observation.blockHash, "finalized block hash");
  assertEqual(block.new_root, observation.stateRoot, "finalized state root");
  assertEqual(block.status, observation.blockStatus, "finalized block status");
}

async function verifyFinalizedDeclaration() {
  const transaction = await rpcResult("starknet_getTransactionByHash", [observation.declaration.transactionHash]);
  assertEqual(transaction.type, "DECLARE", "MMR declaration transaction type");
  assertFeltEqual(transaction.sender_address, observation.declaration.sender, "MMR declaration sender");
  assertFeltEqual(transaction.class_hash, observation.declaration.classHash, "MMR declared Sierra class");
  assertFeltEqual(
    transaction.compiled_class_hash,
    observation.declaration.compiledClassHash,
    "MMR declared compiled class",
  );
  await verifyFinalizedTransactionReceipt(observation.declaration, "declaration");
}

async function verifyFinalizedDeployment() {
  const transaction = await rpcResult("starknet_getTransactionByHash", [observation.deployment.transactionHash]);
  const receipt = await verifyFinalizedTransactionReceipt(observation.deployment, "deployment");
  validateFinalizedMmrDeploymentEvidence(observation.deployment, observation.contractAddress, transaction, receipt);
}

export function validateFinalizedMmrDeploymentEvidence(deployment, contractAddress, transaction, receipt) {
  validateDeploymentTransactionEnvelope(deployment, transaction);

  const recordedCall = parseSingleUdcDeploymentCall(deployment.accountCalldata, "recorded MMR deployment call");
  const liveCall = parseSingleUdcDeploymentCall(transaction.calldata, "live MMR deployment call");
  validateDeploymentCallSemantics(deployment, recordedCall);
  validateDeploymentCallSemantics(deployment, liveCall);

  const deploymentEvent = findUniqueContractDeployedEvent(receipt.events);
  validateRecordedContractDeployedEvent(deployment, deploymentEvent);

  const recordedEvent = parseContractDeployedEventData(
    deployment.contractDeployedEvent.data,
    "recorded MMR ContractDeployed event",
  );
  const liveEvent = parseContractDeployedEventData(deploymentEvent.data, "live MMR ContractDeployed event");
  validateDeploymentEventSemantics(deployment, contractAddress, recordedEvent);
  validateDeploymentEventSemantics(deployment, contractAddress, liveEvent);
}

function validateDeploymentTransactionEnvelope(deployment, transaction) {
  assertEqual(transaction.type, "INVOKE", "MMR deployment transaction type");
  assertFeltEqual(transaction.transaction_hash, deployment.transactionHash, "MMR deployment transaction hash");
  assertFeltEqual(transaction.sender_address, deployment.sender, "MMR deployment sender");
  assertFeltEqual(transaction.version, deployment.transactionVersion, "MMR deployment transaction version");
  assertJsonFeltEqual(transaction.calldata, deployment.accountCalldata, "MMR deployment account calldata");
}

function parseSingleUdcDeploymentCall(accountCalldata, label) {
  assertFeltEqual(accountCalldata[0], "0x1", `${label} call count`);
  const callCalldataLength = readFeltCount(accountCalldata[3], `${label} calldata length`);
  assertEqual(accountCalldata.length, callCalldataLength + 4, `${label} encoded length`);
  if (callCalldataLength < 4) throw new Error(`${label} is missing UDC deployment fields`);

  const constructorCalldataLength = readFeltCount(accountCalldata[7], `${label} constructor calldata length`);
  assertEqual(callCalldataLength, constructorCalldataLength + 4, `${label} constructor framing`);

  return {
    udcAddress: accountCalldata[1],
    selector: accountCalldata[2],
    classHash: accountCalldata[4],
    salt: accountCalldata[5],
    unique: accountCalldata[6],
    constructorCalldata: accountCalldata.slice(8),
  };
}

function validateDeploymentCallSemantics(deployment, call) {
  assertFeltEqual(call.udcAddress, deployment.udc.address, "MMR deployment UDC address");
  assertFeltEqual(call.selector, deployment.udc.deployContractSelector, "MMR deployment selector");
  assertFeltEqual(
    deployment.udc.deployContractSelector,
    hash.getSelectorFromName("deployContract"),
    "MMR canonical deployContract selector",
  );
  assertFeltEqual(call.classHash, deployment.classHash, "MMR deployment class hash");
  assertFeltEqual(call.salt, deployment.udc.salt, "MMR deployment salt");
  assertFeltEqual(call.unique, deployment.udc.unique, "MMR deployment unique flag");
  assertJsonFeltEqual(call.constructorCalldata, deployment.constructorCalldata, "MMR deployment constructor calldata");
}

function findUniqueContractDeployedEvent(events) {
  const selector = hash.getSelectorFromName("ContractDeployed");
  const deploymentEvents = events.filter(({ keys }) => keys.length > 0 && sameFelt(keys[0], selector));
  assertEqual(deploymentEvents.length, 1, "expected exactly one ContractDeployed event");
  return deploymentEvents[0];
}

function validateRecordedContractDeployedEvent(deployment, deploymentEvent) {
  assertFeltEqual(
    deployment.contractDeployedEvent.selector,
    hash.getSelectorFromName("ContractDeployed"),
    "MMR ContractDeployed selector",
  );
  assertFeltEqual(
    deploymentEvent.from_address,
    deployment.contractDeployedEvent.fromAddress,
    "MMR ContractDeployed emitter",
  );
  assertFeltEqual(
    deployment.contractDeployedEvent.fromAddress,
    deployment.udc.address,
    "MMR ContractDeployed UDC emitter",
  );
  assertJsonFeltEqual(deploymentEvent.keys, deployment.contractDeployedEvent.keys, "MMR ContractDeployed keys");
  assertEqual(
    deploymentEvent.data.length,
    deployment.contractDeployedEvent.data.length,
    "MMR ContractDeployed data length",
  );
  assertJsonFeltEqual(deploymentEvent.data, deployment.contractDeployedEvent.data, "MMR ContractDeployed data");
}

function parseContractDeployedEventData(data, label) {
  if (data.length < 6) throw new Error(`${label} is missing deployment fields`);
  const constructorCalldataLength = readFeltCount(data[4], `${label} constructor calldata length`);
  assertEqual(data.length, constructorCalldataLength + 6, `${label} encoded length`);

  return {
    deployedContractAddress: data[0],
    deployer: data[1],
    unique: data[2],
    classHash: data[3],
    constructorCalldata: data.slice(5, 5 + constructorCalldataLength),
    salt: data.at(-1),
  };
}

function validateDeploymentEventSemantics(deployment, contractAddress, event) {
  assertFeltEqual(event.deployedContractAddress, contractAddress, "MMR deployed contract address");
  assertFeltEqual(event.deployer, deployment.sender, "MMR deployment event deployer");
  assertFeltEqual(event.unique, deployment.udc.unique, "MMR deployment event unique flag");
  assertFeltEqual(event.classHash, deployment.classHash, "MMR deployment event class hash");
  assertJsonFeltEqual(
    event.constructorCalldata,
    deployment.constructorCalldata,
    "MMR deployment event constructor calldata",
  );
  assertFeltEqual(event.salt, deployment.udc.salt, "MMR deployment event salt");
}

function readFeltCount(value, label) {
  const count = BigInt(value);
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds the safe integer range`);
  return Number(count);
}

async function verifyFinalizedTransactionReceipt(expected, label) {
  const receipt = await rpcResult("starknet_getTransactionReceipt", [expected.transactionHash]);
  assertEqual(receipt.execution_status, expected.executionStatus, `MMR ${label} execution status`);
  assertEqual(receipt.finality_status, expected.finalityStatus, `MMR ${label} finality status`);
  assertEqual(receipt.block_number, expected.blockNumber, `MMR ${label} block number`);
  assertFeltEqual(receipt.block_hash, expected.blockHash, `MMR ${label} block hash`);
  const block = await rpcResult("starknet_getBlockWithTxHashes", [{ block_number: expected.blockNumber }]);
  assertEqual(block.timestamp, expected.blockTimestamp, `MMR ${label} block timestamp`);
  return receipt;
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
  validateCompleteObservedRoleHistory(roleEvents, observation.roles);

  for (const role of observation.roles) {
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

export function validateCompleteObservedRoleHistory(roleEvents, observedRoles) {
  const roleState = deriveCompleteRoleState(roleEvents);
  validateObservedRoleSet(observedRoles, roleState.roleIds);

  for (const role of observedRoles) {
    const roleId = normalizeFelt(role.roleId);
    const observedMembers = [...roleState.membersByRole.get(roleId)].sort(compareFelts);
    const expectedMembers = role.members.map(normalizeFelt).sort(compareFelts);
    assertJsonEqual(observedMembers, expectedMembers, `role members ${role.name}`);
    assertFeltEqual(role.adminRoleId, roleState.adminByRole.get(roleId), `MMR observed admin role ${roleId}`);
  }
}

function deriveCompleteRoleState(roleEvents) {
  const roleIds = collectRoleIdsFromHistory(roleEvents);
  const membersByRole = new Map([...roleIds].map((roleId) => [roleId, new Set()]));
  const adminByRole = new Map([...roleIds].map((roleId) => [roleId, "0x0"]));

  for (const event of roleEvents) {
    const roleId = normalizeFelt(event.roleId);
    if (event.event === "RoleAdminChanged") {
      applyRoleAdminChange(adminByRole, roleId, event);
      continue;
    }

    const members = membersByRole.get(roleId);
    if (event.event === "RoleGranted") members.add(normalizeFelt(event.account));
    if (event.event === "RoleRevoked") members.delete(normalizeFelt(event.account));
  }

  return { roleIds, membersByRole, adminByRole };
}

function collectRoleIdsFromHistory(roleEvents) {
  const roleIds = new Set();
  for (const event of roleEvents) {
    roleIds.add(normalizeFelt(event.roleId));
    if (event.event === "RoleAdminChanged") {
      roleIds.add(normalizeFelt(event.account));
      roleIds.add(normalizeFelt(event.sender));
    }
  }
  return roleIds;
}

function applyRoleAdminChange(adminByRole, roleId, event) {
  const previousAdminRoleId = normalizeFelt(event.account);
  const newAdminRoleId = normalizeFelt(event.sender);
  assertFeltEqual(previousAdminRoleId, adminByRole.get(roleId), `MMR previous admin role ${roleId}`);
  adminByRole.set(roleId, newAdminRoleId);
}

function validateObservedRoleSet(observedRoles, historicalRoleIds) {
  const observedRoleIds = observedRoles.map(({ roleId }) => normalizeFelt(roleId));
  if (new Set(observedRoleIds).size !== observedRoleIds.length) {
    throw new Error("MMR observed role set contains duplicate role IDs");
  }
  assertJsonEqual(
    observedRoleIds.sort(compareFelts),
    [...historicalRoleIds].sort(compareFelts),
    "MMR observed role set",
  );
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

function assertFeltEqual(actual, expected, label) {
  if (!sameFelt(actual, expected)) throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
}

function assertJsonFeltEqual(actual, expected, label) {
  const normalizedActual = actual.map(normalizeFelt);
  const normalizedExpected = expected.map(normalizeFelt);
  assertJsonEqual(normalizedActual, normalizedExpected, label);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeFelt(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function sameFelt(left, right) {
  return BigInt(left) === BigInt(right);
}

function compareFelts(left, right) {
  return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8"));
}

function isDirectInvocation() {
  return process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}
