import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The machine's integrated GPU, a laptop's or a phone's class of GPU beside a desktop's: on Linux, the DRM card the
 * firmware did not boot the display on. Chrome draws on the default GPU whatever its power-preference flags, so a run
 * on the integrated one launches the browser with Mesa's Vulkan device selection pinned to it, and proves it drew there.
 */

const DRM_ROOT = "/sys/class/drm";
const BROWSERS = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/opt/brave.com/brave/brave",
];

/** `{ vendor, device }` in lower-case hex, as Mesa and ANGLE name it; throws on a machine without one. */
export function findIntegratedGpu(drmRoot = DRM_ROOT) {
  const read = (card, file) => readFileSync(join(drmRoot, card, "device", file), "utf8").trim();
  const cards = readdirSync(drmRoot).filter((name) => /^card\d+$/.test(name));
  const integrated = cards.find((card) => {
    try {
      return read(card, "boot_vga") === "0";
    } catch {
      return false;
    }
  });
  if (!integrated) throw new Error(`--gpu low-power: no second GPU under ${drmRoot} (every card drives the display)`);
  const id = (file) => read(integrated, file).replace(/^0x/, "").toLowerCase();
  return { vendor: id("vendor"), device: id("device") };
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
