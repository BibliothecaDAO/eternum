// @vitest-environment node
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { expect, it } from "vitest";
import { createPwaReleasePlugin } from "./pwa-release";

const ICON = "/images/game-dev-pwa-192x192.png";

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
        plugins: [createPwaReleasePlugin({ release, alertIcon: ICON })],
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
  const plugin = createPwaReleasePlugin({ release, alertIcon: ICON });
  (plugin.generateBundle as (options: unknown, bundle: Rollup.OutputBundle) => void)({}, bundle);
  return (bundle["sw.js"] as { code: string }).code;
}

/** Runs the worker's first line, the stamp, against a stand-in worker scope. */
function stamped(code: string): { REALMS_RELEASE?: unknown; REALMS_ALERT_ICON?: unknown } {
  const self = {};
  new Function("self", code.split("\n")[0])(self);
  return self;
}
const stampedRelease = (code: string) => stamped(code).REALMS_RELEASE;

const body = (code: string) => code.split("\n").slice(1).join("\n");

it("makes each release's worker distinct by its stamp alone, whatever the release label", () => {
  const built = "self.addEventListener('install',()=>{});";
  const first = stampBuiltWorker("release-a", built);
  const next = stampBuiltWorker("release-b */ arbitrary label", built);
  expect(first).not.toBe(next);
  expect([body(first), body(next)]).toEqual([built, built]);
  expect([stampedRelease(first), stampedRelease(next)]).toEqual(["release-a", "release-b */ arbitrary label"]);
});

it("stamps the minified production worker, which carries no production logging, with the icon its alerts show", async () => {
  const worker = await buildWorker("release-a");
  expect(stamped(worker)).toEqual({ REALMS_RELEASE: "release-a", REALMS_ALERT_ICON: ICON });
  expect(worker).not.toContain("pwa_worker_installed");
});
