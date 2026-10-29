// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { evaluatePlaytestSummary } from "./evidence.mjs";
import { drewOn, findIntegratedGpu, resolveBrowserExecutable, writeIntegratedGpuLauncher } from "./integrated-gpu.mjs";

const made = [];
afterEach(() => made.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "integrated-gpu-"));
  made.push(dir);
  return dir;
};

/** `vulkaninfo --summary`'s device list, one GPUn block per [vendor, device, type, name], in the order given. */
const vulkanSummary = (devices) =>
  [
    "Devices:",
    "========",
    ...devices.flatMap(([vendor, device, type, name], index) => [
      `GPU${index}:`,
      "\tapiVersion         = 1.4.318",
      `\tvendorID           = 0x${vendor}`,
      `\tdeviceID           = 0x${device}`,
      `\tdeviceType         = PHYSICAL_DEVICE_TYPE_${type}`,
      `\tdeviceName         = ${name}`,
    ]),
  ].join("\n");

const DISCRETE = ["1002", "7550", "DISCRETE_GPU", "AMD Radeon RX 9070 XT (RADV GFX1201)"];
const INTEGRATED = ["1002", "13C0", "INTEGRATED_GPU", "AMD Ryzen 7 9800X3D (RADV RAPHAEL_MENDOCINO)"];
const CPU = ["10005", "0000", "CPU", "llvmpipe"];

it("finds the integrated GPU by Vulkan's device type, whichever card booted the display", () => {
  const integrated = { vendor: "1002", device: "13c0", name: INTEGRATED[3] };
  // The discrete card first (it booted the display), then the integrated one first: the same answer either way.
  expect(findIntegratedGpu(vulkanSummary([DISCRETE, INTEGRATED, CPU]))).toEqual(integrated);
  expect(findIntegratedGpu(vulkanSummary([INTEGRATED, DISCRETE, CPU]))).toEqual(integrated);
});

it("refuses a machine with no integrated GPU, or more than one", () => {
  expect(() => findIntegratedGpu(vulkanSummary([DISCRETE, CPU]))).toThrow("no integrated GPU");
  const second = ["8086", "a7a0", "INTEGRATED_GPU", "Intel Iris Xe"];
  expect(() => findIntegratedGpu(vulkanSummary([INTEGRATED, second, DISCRETE]))).toThrow(
    "2 integrated GPUs, which one is ambiguous",
  );
});

it("launches the browser seeing only that GPU through Vulkan", () => {
  const dir = scratch();
  const browser = join(dir, "browser.sh");
  writeFileSync(browser, '#!/bin/sh\necho "$MESA_VK_DEVICE_SELECT $*"\n', { mode: 0o755 });

  const launcher = writeIntegratedGpuLauncher(join(dir, "launch.sh"), {
    browser,
    gpu: { vendor: "1002", device: "13c0" },
  });

  expect(execFileSync(launcher, ["--headless", "about:blank"], { encoding: "utf8" })).toBe(
    "1002:13c0! --headless about:blank\n",
  );
  expect(resolveBrowserExecutable({}, (path) => path === "/opt/brave.com/brave/brave")).toBe(
    "/opt/brave.com/brave/brave",
  );
  expect(resolveBrowserExecutable({ AGENT_BROWSER_EXECUTABLE_PATH: "/x/chrome" }, () => false)).toBe("/x/chrome");
});

it("fails a run asked for the integrated GPU that drew on another", () => {
  const discrete = "ANGLE (AMD, Vulkan 1.4 (AMD Radeon RX 9070 XT (RADV GFX1201) (0x00007550)), radv)";
  const integrated = "ANGLE (AMD, Vulkan 1.4 (AMD Ryzen 7 9800X3D (RADV RAPHAEL_MENDOCINO) (0x000013C0)), radv)";
  const gpu = { vendor: "1002", device: "13c0" };
  expect(drewOn(integrated, gpu)).toBe(true);
  expect(drewOn(discrete, gpu)).toBe(false);

  const run = (renderer) => ({
    rendererMode: "webgpu-auto",
    iteration: 1,
    ok: true,
    diagnostics: {},
    gpu: renderer,
    machine: { gpu: "low-power", drewOnIntegratedGpu: drewOn(renderer, gpu), loadAverageMax: 1 },
    metrics: { entryReadyMs: 100, worldInteractiveMs: 200 },
    expectedSteps: [],
    steps: [],
  });
  const failures = (renderer) => evaluatePlaytestSummary({ results: [run(renderer)] }).failures;
  expect(failures(discrete)).toContain(`webgpu-auto #1: asked for the integrated GPU, drew on ${discrete}`);
  expect(failures(integrated).some((failure) => failure.includes("integrated GPU"))).toBe(false);
});
