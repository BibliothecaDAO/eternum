import { expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOGIC = Array.from({ length: 9 }, (_, index) => `0x${(0x100 + index).toString(16)}`);
const manifest = {
  world: { address: "0x1", class_hash: "0x0a1", seed: "test", name: "Games", entrypoints: [], abi: [] },
  native: {
    verifierClassHash: "0xa2",
    logic: Object.fromEntries(LOGIC.map((hash, index) => [`family${index}`, hash])),
  },
  shard: { chainId: "0x4445565f54455354", accountClassHash: "0xa3" },
};

/** A private node that compiles a simulated class 50 ms later, as Madara writes its library into the cache. */
function compilingNode(cache: string) {
  const simulated: string[] = [];
  let compiling = 0;
  let mostAtOnce = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const { params } = (await request.json()) as { params: { transactions: { class_hash: string }[] } };
      const classHash = params.transactions[0]!.class_hash;
      simulated.push(classHash);
      mostAtOnce = Math.max(mostAtOnce, ++compiling);
      setTimeout(() => {
        writeFileSync(join(cache, `${classHash}.so`), "");
        compiling -= 1;
      }, 50);
      return Response.json({ jsonrpc: "2.0", id: 1, error: { code: 41, message: "Transaction execution error" } });
    },
  });
  return { url: `http://127.0.0.1:${server.port}/rpc/v0_10_2`, simulated, mostAtOnce: () => mostAtOnce, server };
}

async function warm(directory: string, url: string, cache: string) {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "warm-native-classes.ts"), directory, url, cache], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (code !== 0) throw new Error(error);
  return JSON.parse(output.trim()) as { passed: boolean; classes: number; compiled: number };
}

it("compiles every class the cache lacks, four at a time, and only reads the cache on the next start", async () => {
  const directory = mkdtempSync(join(tmpdir(), "native-warm-"));
  const cache = join(directory, "native_classes");
  mkdirSync(cache);
  writeFileSync(join(directory, "native-world.json"), JSON.stringify(manifest));
  writeFileSync(join(cache, "0xa1.so"), "");
  const node = compilingNode(cache);
  try {
    expect(await warm(directory, node.url, cache)).toEqual({
      passed: true,
      classes: 12,
      compiled: 11,
      ms: expect.any(Number),
    });
    expect(node.simulated.sort()).toEqual(["0xa2", "0xa3", ...LOGIC].sort());
    expect(node.mostAtOnce()).toBe(4);
    expect(await warm(directory, node.url, cache)).toMatchObject({ classes: 12, compiled: 0 });
    expect(node.simulated).toHaveLength(11);
  } finally {
    node.server.stop(true);
    rmSync(directory, { recursive: true, force: true });
  }
});
