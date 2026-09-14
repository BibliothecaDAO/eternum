#!/usr/bin/env bun
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { RpcProvider } from "starknet";
import { admissionFor, commandArguments, exploreArguments, readFixture, signedRequest } from "./native-intent";

const [path, output] = process.argv.slice(2);
if (!path || !output) throw new Error("usage: race-native-intents.ts FIXTURE_JSON OUTPUT_JSON");
const fixture = readFixture(path);
const provider = new RpcProvider({ nodeUrl: fixture.rpc });
async function submit(request: { intent: string[]; r: string; s: string }) {
  const response = await fetch("http://127.0.0.1:15081/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30000),
  });
  return { status: response.status, body: await response.text() };
}
async function result(order: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const value = await provider.callContract(
      { contractAddress: fixture.execution.address, entrypoint: "get_result", calldata: [order] },
      "pre_confirmed",
    );
    if (BigInt(value[0]) !== 0n) return value;
    await sleep(10);
  }
  throw new Error("Accepted result remains pending; preserve its ticket");
}
const admission = await admissionFor(provider, fixture);
const args = exploreArguments(fixture, admission[3]);
const alternate = [...args.slice(0, -1), "1"];
const requests = [signedRequest(fixture, admission, args), signedRequest(fixture, admission, alternate)];
const responses = await Promise.all(
  Array.from({ length: 32 }, async (_, i) => {
    const { action, ...request } = requests[i % 2];
    return { action, ...(await submit(request)) };
  }),
);
const winners = new Set(responses.filter((entry) => entry.status === 200).map((entry) => entry.action));
assert.equal(winners.size, 1, "Conflicting nonce admitted more than one action");
assert.equal(responses.filter((entry) => entry.status === 200).length, 16);
for (const response of responses.filter((entry) => entry.status !== 200))
  assert(response.status >= 400 && response.status < 500, response.body);
const executed = await result(admission[4]);
assert.equal(BigInt(executed[0]), 1n);
const following = await admissionFor(provider, fixture);
assert.equal(BigInt(following[3]), BigInt(admission[3]) + 1n);
assert.equal(BigInt(following[4]), BigInt(admission[4]) + 1n);

const explorer = Number(exploreArguments(fixture, following[3])[1]);
const { action, ...rejectedRequest } = signedRequest(
  fixture,
  following,
  commandArguments(fixture, "Explore", { explorer_id: explorer, direction: 6 }),
);
const acknowledgement = await submit(rejectedRequest);
assert.equal(acknowledgement.status, 200, acknowledgement.body);
const rejected = await result(following[4]);
assert.equal(BigInt(rejected[0]), 2n, "Invalid direction was not a terminal rejection");
const retry = await submit(rejectedRequest);
assert.deepEqual(retry, acknowledgement);
assert.deepEqual(await result(following[4]), rejected, "Retry changed the accepted binding or terminal result");
const consumed = await admissionFor(provider, fixture);
assert.equal(BigInt(consumed[3]), BigInt(following[3]) + 1n);
assert.equal(BigInt(consumed[4]), BigInt(following[4]) + 1n);
writeFileSync(
  output,
  JSON.stringify(
    {
      schema: 1,
      scope: "real native signed nonce race and terminal exploration retry",
      passed: true,
      race: { order: admission[4], responses, result: executed },
      terminal: { action, order: following[4], acknowledgement, retry, result: rejected },
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
