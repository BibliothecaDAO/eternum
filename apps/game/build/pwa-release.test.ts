// @vitest-environment node
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { expect, it } from "vitest";
import { createPwaReleasePlugin } from "./pwa-release";

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

it("keeps minified worker releases distinct without production logging", async () => {
  const first = await buildWorker("release-a");
  const repeat = await buildWorker("release-a");
  const next = await buildWorker("release-b */ arbitrary label");
  expect(first).toBe(repeat);
  expect(first).not.toBe(next);
  expect(first.split("\n").slice(1).join("\n")).toBe(next.split("\n").slice(1).join("\n"));
  expect(next).toMatch(/^\/\* Realms PWA release: [a-f0-9]{64} \*\//);
  expect(next).not.toContain("arbitrary label");
  expect(next).not.toContain("pwa_worker_installed");
});
