#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CallData, hash, shortString, type Abi } from "starknet";

async function main() {
  const [nativeSource, sierraPath, output] = process.argv.slice(2);
  if (!nativeSource || !sierraPath || !output)
    throw new Error("usage: check-native-routing.ts NATIVE_SOURCE SIERRA_ARTIFACT OUTPUT_JSON");
  const { revision } = JSON.parse(readFileSync(resolve(nativeSource, "revision.json"), "utf8"));
  const artifact = JSON.parse(readFileSync(sierraPath, "utf8"));
  const abi: Abi = typeof artifact.abi === "string" ? JSON.parse(artifact.abi) : artifact.abi;
  const entrypoints = abi
    .flatMap((item) => (item.type === "interface" ? item.items : [item]))
    .filter((item) => item.type === "function");
  const schema = {
    domains: { season: { entrypoints } },
    types: Object.fromEntries(
      abi.filter((item) => item.type === "struct" || item.type === "enum").map((item) => [item.name, item]),
    ),
  };
  const intent = {
    chain: "0x1",
    deployment: "0x2",
    game_id: "0x7",
    actor: "0x1c8",
    nonce: "0x0",
    command: shortString.encodeShortString("explore"),
    rules: "0x315",
    valid_from: 1000,
    valid_until: 1060,
    last_order: 100,
    arguments: ["0x1", "0x2"],
  };
  const context = {
    envelope: [
      shortString.encodeShortString("ETERNUM_ENTROPY"),
      "0x1",
      "0x3",
      "0x1",
      "0x0",
      "0x0",
      "0x3ed",
      "0x3db",
      "0x47868c00",
      "0x1",
      "0x2",
    ],
    authority_epoch: 1,
    accepted_public_key: "0x123",
  };
  const payload = new CallData(abi).compile("execute", { intent, context, r: "0x1", s: "0x1" });
  const calldata = ["0x1", "0x2", hash.getSelectorFromName("execute"), String(payload.length), ...payload];
  const { decodeMembers } = await import(pathToFileURL(resolve(nativeSource, "apps/herald/src/native/serde.ts")).href);
  const execute = entrypoints.find((entry) => entry.name === "execute");
  if (!execute) throw new Error("Compiled fixture has no execute entrypoint");
  const decoded = decodeMembers(schema, execute.inputs, payload);
  if (BigInt(decoded.intent.game_id) !== 7n) throw new Error("Compiled positive routing fixture did not decode");
  const { transactionGameIds } = await import(
    pathToFileURL(resolve(nativeSource, "apps/herald/src/native/transactions.ts")).href
  );
  const actual = transactionGameIds(
    { world: { address: "0x2" }, native: { activeSchema: "fixture", schemas: { fixture: schema } } },
    calldata,
  );
  const passed = JSON.stringify(actual) === JSON.stringify(["7"]);
  writeFileSync(
    output,
    `${JSON.stringify(
      {
        scope: "compiled recorded-intent routing through the native Herald parser; no gameplay or latency measurement",
        nativeRevision: revision,
        decodedGame: String(decoded.intent.game_id),
        expectedGames: ["7"],
        actualGames: actual,
        passed,
        calldata,
      },
      null,
      2,
    )}\n`,
  );
  if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
