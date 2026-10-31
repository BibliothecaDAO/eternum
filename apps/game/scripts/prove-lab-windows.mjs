/**
 * The HUD's windows and modals as the lab draws them (/lab/kit/windows/<surface>, the real components on the lab's
 * fixture game), one screenshot each at the requested size, then one per tab, pressed as a player presses it.
 * Run before and after a window moves onto the HUD sheet: the two runs show each window the same way. Settings is also
 * measured (one short page) and its keys opened with Show and left with Back.
 *
 *   pnpm --dir apps/game prove:windows <base-url> <out-dir> [surface,surface] [widthxheight]
 * Use frontier/<state> for a Frontier window; the default size is 1920x1080.
 */
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runProof, sleep, waitFor } from "./prove-run.mjs";

const READY_MS = 60_000;
const SETTLE_MS = 2_000;

/**
 * Frontier's windows of the same area (its castle and research, the season board, Next up), as the Frontier HUD's lab
 * draws them at /lab/kit/hud/<state>.
 */
const FRONTIER_STATES = [
  "castle",
  "castle-short",
  "research",
  "season",
  "season-detail",
  "season-over",
  "season-over-payout",
  "season-over-payout-no-wallet",
  "visiting",
  "next-up-deploy",
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

/** Every tab of every strip stands inside the panel it belongs to: none is cut, none past the edge, out of reach. */
const TABS_FIT = `[...document.querySelectorAll('[data-popover-panel] [role="tablist"], [data-lab-stage] [role="tablist"]')]
  .every((row) => {
    const panel = (row.closest(".ui-panel, [data-popover-panel]") ?? row.parentElement).getBoundingClientRect();
    return [...row.querySelectorAll('[role="tab"]')].every((tab) => {
      const { left, right } = tab.getBoundingClientRect();
      return left >= panel.left - 0.5 && right <= panel.right + 0.5;
    });
  })`;

/**
 * What holds for a window drawn whole: it did not fall to the error boundary, the page does not scroll sideways, and
 * every tab strip fits its panel.
 */
const windowChecks = (b) => [
  {
    check: "drawn, not the error boundary",
    ok: b.evaluate(`!document.body.innerText.includes("Something went wrong")`),
  },
  { check: "no horizontal overflow", ok: b.evaluate("document.documentElement.scrollWidth <= innerWidth") },
  { check: "every tab strip fits its panel", ok: b.evaluate(TABS_FIT) },
];

/**
 * Settings, the header's popover: it stays one short page, its keys one press away. Measured as the lab draws it at the
 * popover's width; Show opens the keys in its place and Back returns.
 */
const SETTINGS_HEIGHT_MAX = 1080 - 64 - 32;
const settingsMeasure = (b) =>
  b.evaluate(`(() => {
    const panel = document.querySelector("[data-lab-settings]");
    return {
      height: Math.round(panel?.getBoundingClientRect().height ?? 0),
      keysListed: panel?.querySelectorAll("dl dt").length ?? 0,
      shortcutsRow: [...(panel?.querySelectorAll(".ui-setting__name") ?? [])].some((name) => name.textContent === "Keyboard shortcuts"),
    };
  })()`);
const pressButton = (words) => `(() => {
  const button = [...document.querySelectorAll("[data-lab-settings] button")]
    .find((candidate) => (candidate.getAttribute("aria-label") ?? candidate.textContent.trim()) === ${JSON.stringify(words)});
  button?.click();
  return button !== undefined;
})()`;

const proveSettings = async (b, out, record) => {
  const settings = settingsMeasure(b);
  record.checks.push(
    { check: "Settings fits a 1080 px screen under the header", ok: settings.height <= SETTINGS_HEIGHT_MAX, settings },
    {
      check: "Settings lists no key, only the row that opens them",
      ok: settings.keysListed === 0 && settings.shortcutsRow,
    },
  );
  const shown = b.evaluate(pressButton("Show"));
  await sleep(SETTLE_MS / 2);
  b.run("screenshot", join(out, fileName("settings", "keyboard shortcuts")));
  const keys = settingsMeasure(b);
  record.presses.push({ press: "Show", status: shown ? "led" : "unavailable" });
  record.checks.push({
    check: "Show lists the keys in Settings' place",
    ok: shown && keys.keysListed > 0 && !keys.shortcutsRow,
    keys,
  });
  const back = b.evaluate(pressButton("Back"));
  await sleep(SETTLE_MS / 2);
  record.presses.push({ press: "Back", status: back ? "led" : "unavailable" });
  record.checks.push({ check: "Back returns to Settings", ok: back && settingsMeasure(b).shortcutsRow });
};

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
  if (surface === "frontier/season-over-payout-no-wallet")
    record.checks.push({
      check:
        "An account with no linked wallet is told to link one to receive its LORDS, with Link wallet, not paid out",
      ok: b.evaluate(`document.body.innerText.includes("Link a wallet to receive your LORDS") &&
      !document.body.innerText.includes("paid out automatically") &&
      [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Link wallet")`),
    });
  if (surface === "frontier/season-over-payout")
    record.checks.push({
      check: "The remaining LORDS are paid automatically, with no end-of-season withdrawal action",
      ok: b.evaluate(`document.body.innerText.includes("1,240") &&
      document.body.innerText.includes("LORDS are paid out automatically at season end") &&
      ![...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Withdraw")`),
    });
  if (surface === "settings") await proveSettings(b, out, record);
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
  const size = process.argv[5] ?? "1920x1080";
  if (!/^[1-9][0-9]*x[1-9][0-9]*$/.test(size)) throw new Error("Viewport must be widthxheight");
  const viewport = size.split("x");
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/lab-windows"),
      name: "lab-windows",
      baseUrl,
      where: (record) => ({ surface: record.surface }),
    },
    async (b, out, records) => {
      b.run("set", "viewport", ...viewport);
      const surfaces = only ?? [
        ...(await listedSurfaces(b, baseUrl)),
        ...FRONTIER_STATES.map((state) => `frontier/${state}`),
      ];
      if (surfaces.length === 0) records.push({ surface: "the lab's list", ready: false, presses: [] });
      for (const surface of surfaces) records.push(await proveSurface(b, baseUrl, out, surface));
    },
  );
}
