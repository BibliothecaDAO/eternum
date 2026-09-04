import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * three's capability addon answers "is WebGPU available" with a top-level
 * `await navigator.gpu.requestAdapter()`: unbounded, and it turns every chunk
 * that imports it into an async module (the preload chunk's "r is not a
 * function"). The bounded, remembered probe in `webgpu-lane-probe.ts` is the
 * one place that asks.
 */
const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) files.push(fullPath);
  }
  return files;
}

describe("renderer lane discipline", () => {
  it("never imports three's top-level-await WebGPU capability addon", () => {
    const offenders = collectSourceFiles(srcRoot)
      .filter((file) => readFileSync(file, "utf8").includes("capabilities/WebGPU"))
      .map((file) => relative(srcRoot, file));
    expect(offenders).toEqual([]);
  });

  it("keeps renderer lane discovery bounded and fallback independent of the failure class", () => {
    const probe = readFileSync(join(srcRoot, "three", "webgpu-lane-probe.ts"), "utf8");
    expect(probe).toMatch(/WEBGPU_ADAPTER_PROBE_TIMEOUT_MS = 1_000/);
    expect(probe).toMatch(/RENDERER_LANE_STORAGE_KEY = "eternum-renderer-lane"/);
    const backend = readFileSync(join(srcRoot, "three", "webgpu-renderer-backend.ts"), "utf8");
    expect(backend).toMatch(/resolvedDependencies\.resolveLaneStart\(/);
    expect(backend).toMatch(/WEBGPU_BACKEND_STARTUP_TIMEOUT_MS = 3_200/);
    expect(backend).toMatch(/WEBGL2_BACKEND_STARTUP_TIMEOUT_MS = 15_000/);
    expect(backend).not.toContain("isStalledWebGpuLane");
    expect(backend).not.toContain('timedOutMode === "webgpu"');
    // WebGPU is parked: no automatic qualification or idle promotion exists anywhere.
    expect(backend).not.toContain("QUALIFICATION_TIMEOUT");
    expect(backend).not.toContain("idle:init-ok");
    expect(probe).not.toContain("qualifyAtIdle");
  });
});
