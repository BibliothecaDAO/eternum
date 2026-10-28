// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

/** A /sys/class/drm with a card per entry: [name, vendor, device, boot_vga]. */
function drmTree(cards) {
  const root = scratch();
  for (const [name, vendor, device, bootVga] of cards) {
    mkdirSync(join(root, name, "device"), { recursive: true });
    writeFileSync(join(root, name, "device", "vendor"), `${vendor}\n`);
    writeFileSync(join(root, name, "device", "device"), `${device}\n`);
    writeFileSync(join(root, name, "device", "boot_vga"), `${bootVga}\n`);
  }
  mkdirSync(join(root, "card1-DP-1"));
  return root;
}

it("finds the card the display did not boot on, as Mesa names it", () => {
  const root = drmTree([
    ["card0", "0x1002", "0x13C0", 0],
    ["card1", "0x1002", "0x7550", 1],
  ]);
  expect(findIntegratedGpu(root)).toEqual({ vendor: "1002", device: "13c0" });
  expect(() => findIntegratedGpu(drmTree([["card0", "0x1002", "0x7550", 1]]))).toThrow("no second GPU");
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
