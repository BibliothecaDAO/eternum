// @vitest-environment node
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { expect, it } from "vitest";
import { createPwaReleasePlugin } from "./pwa-release";

/** The worker's minified production build, stamped with this release. */
async function buildWorker(release: string): Promise<string> {
  const result = await build({
    configFile: false,
    publicDir: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: true,
      rollupOptions: {
        input: fileURLToPath(new URL("../src/sw.ts", import.meta.url)),
        plugins: [createPwaReleasePlugin(release)],
        output: { inlineDynamicImports: true },
      },
    },
  });
  if (!("output" in result)) throw new Error("Expected one worker build");
  const worker = result.output.find((output) => output.type === "chunk" && output.isEntry);
  if (!worker || worker.type !== "chunk") throw new Error("Expected a worker entry");
  return worker.code;
}

/** The plugin's stamp on a built worker entry, as Rollup hands it the bundle. */
function stampBuiltWorker(release: string, code: string): string {
  const bundle = { "sw.js": { type: "chunk", isEntry: true, code } } as unknown as Rollup.OutputBundle;
  const plugin = createPwaReleasePlugin(release);
  (plugin.generateBundle as (options: unknown, bundle: Rollup.OutputBundle) => void)({}, bundle);
  return (bundle["sw.js"] as { code: string }).code;
}

/** Runs the worker's first line, the release stamp, against a stand-in worker scope. */
function stampedRelease(code: string): unknown {
  const self: { REALMS_RELEASE?: unknown } = {};
  new Function("self", code.split("\n")[0])(self);
  return self.REALMS_RELEASE;
}

const body = (code: string) => code.split("\n").slice(1).join("\n");

it("makes each release's worker distinct by its stamp alone, whatever the release label", () => {
  const built = "self.addEventListener('install',()=>{});";
  const first = stampBuiltWorker("release-a", built);
  const next = stampBuiltWorker("release-b */ arbitrary label", built);
  expect(first).not.toBe(next);
  expect([body(first), body(next)]).toEqual([built, built]);
  expect([stampedRelease(first), stampedRelease(next)]).toEqual(["release-a", "release-b */ arbitrary label"]);
});

it("stamps the minified production worker, which carries no production logging", async () => {
  const worker = await buildWorker("release-a");
  expect(stampedRelease(worker)).toBe("release-a");
  expect(worker).not.toContain("pwa_worker_installed");
});
