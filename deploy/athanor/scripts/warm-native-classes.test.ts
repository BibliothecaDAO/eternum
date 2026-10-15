import { expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { warmClasses } from "./warm-native-classes";

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
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const { params } = (await request.json()) as { params: { transactions: { class_hash: string }[] } };
      const classHash = params.transactions[0]!.class_hash;
      simulated.push(classHash);
      setTimeout(() => {
        writeFileSync(join(cache, `${classHash}.so`), "");
      }, 50);
      return Response.json({ jsonrpc: "2.0", id: 1, error: { code: 41, message: "Transaction execution error" } });
    },
  });
  return { url: `http://127.0.0.1:${server.port}/rpc/v0_10_2`, simulated, server };
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

it("asks the private node for every class the cache lacks, and only reads the cache on the next start", async () => {
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
    expect(await warm(directory, node.url, cache)).toMatchObject({ classes: 12, compiled: 0 });
    expect(node.simulated).toHaveLength(11);
  } finally {
    node.server.stop(true);
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * Madara's compiler on a virtual clock: four slots, a request beyond them refused rather than queued, a class already
 * compiling not started twice, and a class that fails to compile frees its slot without producing a library.
 */
function madaraCompiler({ busyUntil = [] as number[], failing = new Set<string>(), compileMs = 1_500 } = {}) {
  let clock = 0;
  const jobs = busyUntil.map((finishesAt) => ({ classHash: "foreign", finishesAt }));
  const compiled = new Set<string>();
  const refused: string[] = [];
  let mostAtOnce = 0;
  const settle = () => {
    for (const job of jobs.filter(({ finishesAt }) => finishesAt <= clock)) {
      jobs.splice(jobs.indexOf(job), 1);
      if (job.classHash !== "foreign" && !failing.has(job.classHash)) compiled.add(job.classHash);
    }
  };
  return {
    refused,
    mostAtOnce: () => mostAtOnce,
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
      settle();
    },
    isCompiled: (classHash: string) => compiled.has(classHash),
    requestCompilation: async (classHash: string) => {
      if (compiled.has(classHash) || jobs.some((job) => job.classHash === classHash)) return;
      if (jobs.length >= 4) refused.push(classHash);
      else jobs.push({ classHash, finishesAt: clock + compileMs });
      mostAtOnce = Math.max(mostAtOnce, jobs.length);
    },
  };
}

it("finishes every class after its first requests were refused by compilations it did not start", async () => {
  const compiler = madaraCompiler({ busyUntil: [3_000, 3_000, 5_000] });
  const warmed = await warmClasses(LOGIC, compiler, { now: compiler.now, sleep: compiler.sleep });
  expect(warmed).toBe(9);
  expect(LOGIC.every((classHash) => compiler.isCompiled(classHash))).toBe(true);
  expect(compiler.refused.length).toBeGreaterThan(0);
  expect(compiler.mostAtOnce()).toBe(4);
});

it("counts only the classes missing when it starts", async () => {
  const compiler = madaraCompiler();
  await warmClasses(LOGIC.slice(0, 2), compiler, { now: compiler.now, sleep: compiler.sleep });
  expect(await warmClasses(LOGIC, compiler, { now: compiler.now, sleep: compiler.sleep })).toBe(7);
});

it("never reports readiness while a class keeps failing to compile, and names it at the deadline", async () => {
  const compiler = madaraCompiler({ failing: new Set([LOGIC[4]!]) });
  await expect(
    warmClasses(LOGIC, compiler, { deadlineMs: 60_000, now: compiler.now, sleep: compiler.sleep }),
  ).rejects.toThrow(`Classes not compiled natively by the deadline: ${LOGIC[4]}`);
  expect(compiler.now()).toBeGreaterThanOrEqual(60_000);
});
