import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";

/**
 * Madara compiles a class to native code the first time it executes it, and runs that execution on the VM, 2–4× slower.
 * Before the shard lists a game, this makes Madara compile every class of the world: simulating a deployment of a class
 * loads it, which starts its compilation, and the compiled library appearing in Madara's cache directory marks it done.
 * A simulation changes no state, and a class compiled by an earlier start is already in the cache, so a restart only
 * reads the directory.
 */
const COMPILES_AT_ONCE = 4; // Madara's --native-max-concurrent-compilations; one more is refused, not queued.
const COMPILE_TIMEOUT_MS = 300_000; // Madara's own per-class compilation timeout.
const POLL_MS = 500;

async function main(): Promise<void> {
  const [directory, rpcUrl, cacheDirectory] = process.argv.slice(2);
  if (!directory || !rpcUrl || !cacheDirectory)
    throw new Error("Usage: bun warm-native-classes.ts RUN_DIRECTORY PRIVATE_RPC_URL NATIVE_CACHE_DIRECTORY");
  const classes = worldClasses(readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json")));
  const started = Date.now();
  const missing = classes.filter((classHash) => !isCompiled(cacheDirectory, classHash));
  for (let offset = 0; offset < missing.length; offset += COMPILES_AT_ONCE)
    await Promise.all(
      missing.slice(offset, offset + COMPILES_AT_ONCE).map((classHash) => compile(rpcUrl, cacheDirectory, classHash)),
    );
  console.log(
    JSON.stringify({ passed: true, classes: classes.length, compiled: missing.length, ms: Date.now() - started }),
  );
}

/** Every class a play can execute: the Games world, its logic libraries, the stamp verifier and the player account. */
function worldClasses(manifest: NativeWorldManifest): string[] {
  const { native, shard, world } = manifest;
  const hashes = [world.class_hash, native.verifierClassHash, shard.accountClassHash, ...Object.values(native.logic)];
  return [...new Set(hashes.filter((hash): hash is string => !!hash && BigInt(hash) !== 0n).map(canonicalHash))];
}

const canonicalHash = (hash: string) => `0x${BigInt(hash).toString(16)}`;

const isCompiled = (cacheDirectory: string, classHash: string) =>
  existsSync(join(cacheDirectory, `${canonicalHash(classHash)}.so`));

async function compile(rpcUrl: string, cacheDirectory: string, classHash: string): Promise<void> {
  await simulateDeployment(rpcUrl, classHash);
  const deadline = Date.now() + COMPILE_TIMEOUT_MS;
  while (!isCompiled(cacheDirectory, classHash)) {
    if (Date.now() > deadline) throw new Error(`Class ${classHash} did not compile natively within Madara's timeout`);
    await Bun.sleep(POLL_MS);
  }
}

/** Its answer does not matter, only that Madara loaded the class to run it; a class with no constructor still loads. */
async function simulateDeployment(rpcUrl: string, classHash: string): Promise<void> {
  const bound = { max_amount: "0x0", max_price_per_unit: "0x0" };
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_simulateTransactions",
      params: {
        block_id: "latest",
        transactions: [
          {
            type: "DEPLOY_ACCOUNT",
            version: "0x3",
            signature: [],
            nonce: "0x0",
            contract_address_salt: "0x1",
            constructor_calldata: [],
            class_hash: classHash,
            resource_bounds: { l1_gas: bound, l1_data_gas: bound, l2_gas: bound },
            tip: "0x0",
            paymaster_data: [],
            nonce_data_availability_mode: "L1",
            fee_data_availability_mode: "L1",
          },
        ],
        simulation_flags: ["SKIP_VALIDATE", "SKIP_FEE_CHARGE"],
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Private node answered ${response.status} while loading class ${classHash}`);
}

if (import.meta.main) await main();
