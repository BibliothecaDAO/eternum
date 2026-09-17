#!/usr/bin/env bun
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { hash, RpcProvider, shortString } from "starknet";

import {
  admissionFor,
  exploreArguments,
  hex,
  readFixture,
  signedRequest,
  waitForOutcome,
  type NativeFixture as Fixture,
} from "./native-intent";

async function post(endpoint: string, body: unknown) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status, body: await response.text() };
}

async function previewAttempts(
  provider: RpcProvider,
  fixture: Fixture,
  intent: string[],
  admission: string[],
  action: string,
  r: string,
  s: string,
) {
  const envelope = [
    shortString.encodeShortString("ETERNUM_ENTROPY"),
    "0x2",
    action,
    admission[4],
    admission[5],
    admission[6],
    admission[2],
    hex(1_200_000_000),
    "0x1",
    "0x2",
  ];
  const [epoch] = await provider.callContract(
    { contractAddress: fixture.authority.address, entrypoint: "authority_epoch", calldata: [] },
    "pre_confirmed",
  );
  const execution = [...intent.slice(2), hex(envelope.length), ...envelope, epoch, admission[0], r, s];
  const calldata = [
    "0x1",
    fixture.execution.address,
    hash.getSelectorFromName("execute"),
    hex(execution.length),
    ...execution,
  ];
  const transaction = {
    type: "INVOKE",
    version: "0x3",
    sender_address: fixture.authority.address,
    nonce: await provider.getNonceForAddress(fixture.authority.address, "pre_confirmed"),
    calldata,
    signature: ["0x1", "0x1"],
    resource_bounds: {
      l1_gas: { max_amount: hex(100_000), max_price_per_unit: hex(128) },
      l2_gas: { max_amount: hex(1_200_000_000), max_price_per_unit: hex(100_000) },
      l1_data_gas: { max_amount: hex(100_000), max_price_per_unit: hex(128) },
    },
    tip: "0x0",
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
  const attempts = [
    {
      name: "simulation",
      method: "starknet_simulateTransactions",
      params: { block_id: "pre_confirmed", transactions: [transaction], simulation_flags: [] },
    },
    {
      name: "simulation skipping validation",
      method: "starknet_simulateTransactions",
      params: {
        block_id: "pre_confirmed",
        transactions: [transaction],
        simulation_flags: ["SKIP_VALIDATE", "SKIP_FEE_CHARGE"],
      },
    },
    {
      name: "estimation",
      method: "starknet_estimateFee",
      params: { block_id: "pre_confirmed", request: [transaction], simulation_flags: ["SKIP_VALIDATE"] },
    },
    {
      name: "direct entrypoint call",
      method: "starknet_call",
      params: {
        block_id: "pre_confirmed",
        request: {
          contract_address: fixture.execution.address,
          entry_point_selector: hash.getSelectorFromName("execute"),
          calldata: execution,
        },
      },
    },
  ];
  const results = [];
  for (const attempt of attempts) {
    const response = await fetch(fixture.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: attempt.method, params: attempt.params }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    assert.notEqual(result.error?.code, -32602, `${attempt.name}: malformed RPC request`);
    assert.notEqual(result.error?.code, -32601, `${attempt.name}: method unavailable`);
    const rejection = result.error ?? result.result?.[0]?.transaction_trace?.execute_invocation?.revert_reason;
    assert(rejection, `${attempt.name}: preview executed`);
    assert.match(
      JSON.stringify(rejection),
      /authority|sequencing submitter|transaction version|query/i,
      `${attempt.name}: unrelated rejection ${JSON.stringify(rejection)}`,
    );
    results.push({ name: attempt.name, rejection });
  }
  return results;
}

async function main() {
  const [manifestPath, outputPath, placement] = process.argv.slice(2);
  if (!manifestPath || !outputPath)
    throw new Error("usage: bun deploy/madara-rand/exercise-fixture.ts FIXTURE_JSON OUTPUT_JSON PLACEMENT");
  if (placement !== "embedded" && placement !== "sidecar") throw new Error("Select embedded or sidecar");
  const endpoint = `http://127.0.0.1:${placement === "embedded" ? 15080 : 15081}/actions`;
  const fixture = readFixture(manifestPath);
  const provider = new RpcProvider({ nodeUrl: fixture.rpc });
  assert.equal(BigInt(await provider.getChainId()), BigInt(fixture.chain));
  const admission = await admissionFor(provider, fixture);
  const nonce = admission[3];
  const order = admission[4];
  const { action, ...request } = signedRequest(fixture, admission, exploreArguments(fixture, nonce));
  const intent = request.intent;
  const previews = await previewAttempts(provider, fixture, intent, admission, action, request.r, request.s);
  const rejections: { name: string; status: number }[] = [];
  const attempts = [
    ["player-supplied root", { ...request, root: "0x123" }],
    ["transport identity", { ...request, request_id: "another-draw" }],
    ["malformed intent", { ...request, intent: [] }],
    ["forged signature", { ...request, r: "0x1" }],
    ["foreign actor", { ...request, intent: intent.map((felt, index) => (index === 5 ? "0x999" : felt)) }],
    ["foreign game", { ...request, intent: intent.map((felt, index) => (index === 4 ? "0x999" : felt)) }],
    ["altered arguments", { ...request, intent: intent.map((felt, index) => (index === 14 ? "0x999" : felt)) }],
  ] as const;
  for (const [name, attempt] of attempts) {
    const response = await post(endpoint, attempt);
    assert(response.status >= 400 && response.status < 500, `${name}: ${response.status}`);
    rejections.push({ name, status: response.status });
  }
  const gate = process.env.RANDOMNESS_ADMISSION_GATE;
  if (gate) {
    writeFileSync(`${gate}.ready.json`, JSON.stringify({ action, order }) + "\n", { flag: "wx" });
    const deadline = Date.now() + 20_000;
    while (!existsSync(`${gate}.go`) && Date.now() < deadline) await sleep(10);
    assert(existsSync(`${gate}.go`), "Rehearsal did not release the admission gate");
  }
  const submissionEpochMs = performance.timeOrigin + performance.now();
  const responses = await Promise.all(Array.from({ length: 16 }, () => post(endpoint, request)));
  const acknowledgementEpochMs = performance.timeOrigin + performance.now();
  for (const response of responses) {
    assert.equal(response.status, 200, response.body);
    const accepted = JSON.parse(response.body);
    assert.deepEqual(Object.keys(accepted).sort(), ["action", "order"]);
    assert.equal(BigInt(accepted.action), BigInt(action));
    assert.equal(BigInt(accepted.order), BigInt(order));
  }
  const result = await waitForOutcome(provider, fixture, endpoint, action);
  assert.equal(BigInt(result.status), 1n, "Native explore was terminally rejected");
  const following = await provider.callContract(
    {
      contractAddress: fixture.execution.address,
      entrypoint: "get_admission",
      calldata: [fixture.game, fixture.actor],
    },
    "pre_confirmed",
  );
  assert.equal(BigInt(following[3]), BigInt(nonce) + 1n);
  assert.equal(BigInt(following[4]), BigInt(order) + 1n);
  assert.equal(BigInt(result.order), BigInt(order));
  assert(result.nonceConsumed);
  const changed = { ...request, intent: [...intent.slice(0, -1), "0x3"] };
  const conflict = await post(endpoint, changed);
  assert.equal(conflict.status, 400);
  const replay = await post(endpoint, request);
  assert.equal(replay.status, 200);
  const replayResult = await waitForOutcome(provider, fixture, endpoint, action);
  assert.deepEqual(replayResult, result);
  writeFileSync(
    outputPath,
    `${JSON.stringify({ scope: "native explore admission and recovery; not latency-budget evidence", action, order, nonce, submissionEpochMs, acknowledgementEpochMs, previews, rejections, duplicates: responses.length, conflict: conflict.status, result }, null, 2)}\n`,
    { flag: "wx" },
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
