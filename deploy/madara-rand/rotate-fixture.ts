#!/usr/bin/env bun
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ec, RpcProvider } from "starknet";
import { waitForSuccess } from "../../config/deployer/clean/shared/declare";
import { fixtureAdmin } from "./fixture-admin";

async function main() {
  const [fixturePath, output, epochText] = process.argv.slice(2);
  if (!fixturePath || !output) throw new Error("usage: rotate-fixture.ts FIXTURE_JSON OUTPUT_JSON NEXT_EPOCH");
  const epoch = Number(epochText);
  assert(Number.isSafeInteger(epoch) && epoch > 1 && epoch < 100);
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.equal(fixture.rpc, "http://127.0.0.1:15050/rpc/v0_9_0");
  const provider = new RpcProvider({ nodeUrl: fixture.rpc });
  assert.equal(BigInt(await provider.getChainId()), BigInt(fixture.chain));
  const account = fixtureAdmin(provider);
  const publicKey = ec.starkCurve.getStarkKey(`0x${(0xd430 + epoch).toString(16)}`);
  const transaction = await account.execute(
    {
      contractAddress: fixture.authority.address,
      entrypoint: "rotate",
      calldata: [publicKey, `0x${epoch.toString(16)}`],
    },
    { tip: 0 },
  );
  await waitForSuccess(account, transaction.transaction_hash);
  writeFileSync(
    output,
    JSON.stringify({ epoch, publicKey, transaction: transaction.transaction_hash }, null, 2) + "\n",
    { flag: "wx" },
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
