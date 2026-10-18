/**
 * The HUD's windows and modals as the lab draws them (/lab/kit/windows/<surface>, the real components on the lab's
 * fixture game), one screenshot each at 1920×1080, then one per tab the window holds, pressed as a player presses it.
 * Run before and after a window moves onto the HUD sheet: the two runs show each window the same way.
 *
 *   node scripts/prove-lab-windows.mjs <base-url> <out-dir> [surface,surface]   (frontier/<state> for a Frontier window)
 */
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runProof, sleep, waitFor } from "./prove-run.mjs";

const VIEWPORT = ["1920", "1080"];
const READY_MS = 60_000;
const SETTLE_MS = 2_000;

/**
 * Frontier's windows of the same area (its castle and training, the season board, the guide), as the Frontier HUD's lab
 * draws them at /lab/kit/hud/<state>.
 */
const FRONTIER_STATES = [
  "castle",
  "castle-short",
  "train-battle",
  "train-short",
  "season",
  "season-detail",
  "season-over",
  "season-over-withdraw",
  "visiting",
  "guide",
  "guide-season",
];

/** The surfaces the lab lists, by the name in their address; none when the lab never drew its list. */
const listedSurfaces = async (b, baseUrl) => {
  b.run("open", `${baseUrl}/lab/kit/windows`, "--ignore-https-errors");
  if (!(await waitFor(b, `document.querySelector("[data-lab-surface]") !== null`, READY_MS))) return [];
  return b.evaluate(`[...document.querySelectorAll("[data-lab-surface]")].map((link) => link.dataset.labSurface)`);
};

/** The window's tabs not yet shown, by their words: each is pressed in turn. */
const TABS = `[...document.querySelectorAll('[data-popover-panel] [role="tab"], [data-lab-stage] [role="tab"]')]
  .filter((tab) => tab.getAttribute("aria-selected") !== "true" && !tab.disabled)
  .map((tab) => tab.textContent.trim())`;

const pressTab = (words) => `(() => {
  const tab = [...document.querySelectorAll('[data-popover-panel] [role="tab"], [data-lab-stage] [role="tab"]')]
    .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(words)});
  tab?.click();
  return tab !== undefined;
})()`;

/** What holds for a window drawn whole: it did not fall to the error boundary, and the page does not scroll sideways. */
const windowChecks = (b) => [
  {
    check: "drawn, not the error boundary",
    ok: b.evaluate(`!document.body.innerText.includes("Something went wrong")`),
  },
  { check: "no horizontal overflow", ok: b.evaluate("document.documentElement.scrollWidth <= innerWidth") },
];

/** The first tab on screen not yet pressed, if any is left. */
const nextTab = (b, shown) => b.evaluate(TABS).find((tab) => !shown.has(tab));

const fileName = (surface, tab) =>
  `${surface.replace("/", "-")}${tab ? `--${tab.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.png`;

const proveSurface = async (b, baseUrl, out, surface) => {
  const frontier = surface.startsWith("frontier/");
  const path = frontier ? `hud/${surface.slice("frontier/".length)}` : `windows/${surface}`;
  b.run("open", `${baseUrl}/lab/kit/${path}`, "--ignore-https-errors");
  const drawn = frontier
    ? `document.body.innerText.trim().length > 0`
    : `document.querySelector("[data-lab-stage]") !== null`;
  const record = {
    surface,
    ready: await waitFor(b, drawn, READY_MS),
    presses: [],
    checks: [],
  };
  if (!record.ready) return record;
  await sleep(SETTLE_MS);
  b.run("screenshot", join(out, fileName(surface)));
  record.checks.push(...windowChecks(b));
  // A tab can change the tabs beside it (a market's view): the list is read again after each press.
  const shown = new Set();
  for (let tab = nextTab(b, shown); tab !== undefined; tab = nextTab(b, shown)) {
    shown.add(tab);
    const pressed = b.evaluate(pressTab(tab));
    await sleep(SETTLE_MS / 2);
    if (pressed) b.run("screenshot", join(out, fileName(surface, tab)));
    if (pressed) record.checks.push(...windowChecks(b).map((check) => ({ ...check, tab })));
    record.presses.push({ tab, status: pressed ? "led" : "unavailable" });
  }
  return record;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = (process.argv[2] ?? "https://127.0.0.1:4176").replace(/\/$/, "");
  const only = process.argv[4]?.split(",");
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/lab-windows"),
      name: "lab-windows",
      baseUrl,
      where: (record) => ({ surface: record.surface }),
    },
    async (b, out, records) => {
      b.run("set", "viewport", ...VIEWPORT);
      const surfaces = only ?? [
        ...(await listedSurfaces(b, baseUrl)),
        ...FRONTIER_STATES.map((state) => `frontier/${state}`),
      ];
      if (surfaces.length === 0) records.push({ surface: "the lab's list", ready: false, presses: [] });
      for (const surface of surfaces) records.push(await proveSurface(b, baseUrl, out, surface));
    },
  );
}
