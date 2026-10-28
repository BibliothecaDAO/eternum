import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

/**
 * The machine's integrated GPU, a laptop's or a phone's class of GPU beside a desktop's, as Vulkan classifies its
 * devices (which card booted the display says nothing about which one is integrated). Chrome draws on the default GPU
 * whatever its power-preference flags, so a run on the integrated one launches the browser with Mesa's Vulkan device
 * selection pinned to it, and proves it drew there.
 */

const BROWSERS = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/opt/brave.com/brave/brave",
];

/**
 * `{ vendor, device, name }` in lower-case hex, as Mesa and ANGLE name it, of the one device `vulkaninfo --summary`
 * reports as PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU. Refuses a machine with none, or with more than one, rather than guess.
 */
export function findIntegratedGpu(vulkanSummary = readVulkanSummary()) {
  const integrated = parseVulkanDevices(vulkanSummary).filter((gpu) => gpu.type === "INTEGRATED_GPU");
  if (integrated.length === 0) throw new Error("--gpu low-power: Vulkan reports no integrated GPU on this machine");
  if (integrated.length > 1) {
    const names = integrated.map((gpu) => `${gpu.vendor}:${gpu.device} ${gpu.name}`).join("; ");
    throw new Error(`--gpu low-power: ${integrated.length} integrated GPUs, which one is ambiguous (${names})`);
  }
  const [{ vendor, device, name }] = integrated;
  return { vendor, device, name };
}

/** Each GPUn block of `vulkaninfo --summary`: its vendor and device id, device type and name. */
function parseVulkanDevices(summary) {
  return summary
    .split(/^GPU\d+:\s*$/m)
    .slice(1)
    .map((block) => {
      const field = (key) => new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, "m").exec(block)?.[1].trim();
      return {
        vendor: field("vendorID")?.replace(/^0x/, "").toLowerCase(),
        device: field("deviceID")?.replace(/^0x/, "").toLowerCase(),
        type: field("deviceType")?.replace(/^PHYSICAL_DEVICE_TYPE_/, ""),
        name: field("deviceName") ?? "",
      };
    });
}

function readVulkanSummary() {
  const result = spawnSync("vulkaninfo", ["--summary"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error("--gpu low-power: vulkaninfo --summary did not run; it tells the integrated GPU from the others");
  }
  return result.stdout;
}

/** The browser agent-browser launches: the one it is told to, else the first installed Chrome, Chromium or Brave. */
export function resolveBrowserExecutable(env = process.env, exists = existsSync) {
  const browser = env.AGENT_BROWSER_EXECUTABLE_PATH || BROWSERS.find((path) => exists(path));
  if (!browser) throw new Error("--gpu low-power: no browser found; set AGENT_BROWSER_EXECUTABLE_PATH");
  return browser;
}

/** A launcher, written at `path`, that runs `browser` seeing only `gpu` through Vulkan. */
export function writeIntegratedGpuLauncher(path, { browser, gpu }) {
  writeFileSync(path, `#!/bin/sh\nMESA_VK_DEVICE_SELECT=${gpu.vendor}:${gpu.device}! exec "${browser}" "$@"\n`, {
    mode: 0o755,
  });
  return path;
}

/** Whether the page's WebGL renderer string (ANGLE names the device id) is `gpu`'s. */
export const drewOn = (renderer, gpu) => new RegExp(`\\(0x0*${gpu.device}\\)`, "i").test(renderer ?? "");
