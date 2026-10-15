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
 *
 * Madara compiles at most four classes at once and refuses, rather than queues, a fifth, including while it is still
 * compiling work this step did not start. A class it is already compiling is not compiled twice. So every round asks
 * again for every class still missing: a refused request is simply repeated once a slot frees, and the step never needs
 * to know which slots are whose. One budget bounds every request and every wait: nothing starts after it expires, and
 * a class that compiles only after it still fails the start, naming the classes missing.
 */
// On dev the 20 classes compiled in 11–15 s each, the largest well under a minute; at four at a time that is five
// waves, about five minutes at worst. The budget is three times that.
const WARM_BUDGET_MS = 900_000;
const REQUEST_MS = 30_000;
const ROUND_MS = 2_000;

interface Compiler {
  isCompiled(classHash: string): boolean;
  requestCompilation(classHash: string, timeoutMs: number): Promise<void>;
}

async function main(): Promise<void> {
  const [directory, rpcUrl, cacheDirectory] = process.argv.slice(2);
  if (!directory || !rpcUrl || !cacheDirectory)
    throw new Error("Usage: bun warm-native-classes.ts RUN_DIRECTORY PRIVATE_RPC_URL NATIVE_CACHE_DIRECTORY");
  const classes = worldClasses(readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json")));
  const started = Date.now();
  const warmed = await warmClasses(classes, {
    isCompiled: (classHash) => existsSync(join(cacheDirectory, `${classHash}.so`)),
    requestCompilation: (classHash, timeoutMs) => simulateDeployment(rpcUrl, classHash, timeoutMs),
  });
  console.log(JSON.stringify({ passed: true, classes: classes.length, ...warmed, ms: Date.now() - started }));
}

/**
 * Every class compiled within the budget: how many were missing when it started, and how many requests each needed
 * (more than one means Madara refused it or was still compiling it).
 */
export async function warmClasses(
  classes: string[],
  compiler: Compiler,
  { budgetMs = WARM_BUDGET_MS, roundMs = ROUND_MS, now = Date.now, sleep = Bun.sleep } = {},
): Promise<{ compiled: number; requests: Record<string, number> }> {
  const deadline = now() + budgetMs;
  const remaining = () => deadline - now();
  const missingNow = () => classes.filter((classHash) => !compiler.isCompiled(classHash));
  const compiled = missingNow().length;
  const requests: Record<string, number> = {};
  let lastFailure = "";
  for (;;) {
    const missing = missingNow();
    if (remaining() <= 0)
      throw new Error(
        `Classes not compiled natively within ${budgetMs / 1000} s: ${missing.join(", ") || "all, but after the budget"}` +
          (lastFailure && `; last request failure: ${lastFailure}`),
      );
    if (!missing.length) return { compiled, requests };
    for (const classHash of missing) {
      if (remaining() <= 0) break;
      requests[classHash] = (requests[classHash] ?? 0) + 1;
      await compiler
        .requestCompilation(classHash, Math.min(REQUEST_MS, remaining()))
        .catch((error: unknown) => void (lastFailure = error instanceof Error ? error.message : String(error)));
    }
    if (remaining() > 0) await sleep(Math.min(roundMs, remaining()));
  }
}

/** Every class a play can execute: the Games world, its logic libraries, the stamp verifier and the player account. */
function worldClasses(manifest: NativeWorldManifest): string[] {
  const { native, shard, world } = manifest;
  const hashes = [world.class_hash, native.verifierClassHash, shard.accountClassHash, ...Object.values(native.logic)];
  return [...new Set(hashes.filter((hash): hash is string => !!hash && BigInt(hash) !== 0n).map(canonicalHash))];
}

const canonicalHash = (hash: string) => `0x${BigInt(hash).toString(16)}`;

/** Its answer does not matter, only that Madara loaded the class to run it; a class with no constructor still loads. */
async function simulateDeployment(rpcUrl: string, classHash: string, timeoutMs: number): Promise<void> {
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
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Private node answered ${response.status} while loading class ${classHash}`);
}

if (import.meta.main) await main();
