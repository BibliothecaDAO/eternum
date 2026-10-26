#!/usr/bin/env node
/**
 * The HUD sheet migration's before-and-after: every HUD surface the lab draws, shot at 1920×1080 (the desktop HUD's
 * stage also at 1024×768, 1280×720 and 1440×900), one picture per surface and size. Against a running dev build (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game capture:hud-lab --base-url https://127.0.0.1:<port> --out <dir> [--only <surface>,...]
 *
 * Run it on the commit before a change and again after; the two directories hold the same file names. A surface the
 * page does not draw (its `[data-lab]` mark missing) fails the run, so a broken surface never passes as a picture. The
 * desktop HUD's stage is also held to its bottom-left rule at each size (scripts/hud-sheet/clearance.mjs): the minimap in
 * the left column's corner, the foot between the columns.
 *
 * With `--hud-layout`, it holds the in-game HUD's desktop layout instead: each of HUD_LAYOUT_PAGES at each of the
 * DESKTOPS sizes, read and judged as the playtest's `hud-layout` step judges a live map (judgeHudLayout: every part
 * drawn whole on the page, none over another, every control reachable, at most seven parts a region), writing a picture
 * each and `hud-layout.json`, and failing the run on any fault.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { hudClearanceProblems, READ_HUD_BOXES } from "../../../scripts/hud-sheet/clearance.mjs";

import { HUD_LAYOUT_EXPRESSION, judgeHudLayout } from "./client-playtest/hud-layout.mjs";
import { runAgentBrowser } from "./run-renderer-scene-smoke.mjs";

const VIEWPORT = [1920, 1080];
/** The desktop sizes the HUD's layout is held at: the narrowest desktop, a small laptop, a laptop, a full HD screen. */
const DESKTOPS = [[1024, 768], [1280, 720], [1440, 900], VIEWPORT];
const SETTLE_MS = "1200";

/** Each surface: the lab page that draws it, the mark the page puts on it, and its sizes when not just 1920×1080. */
export const SURFACES = [
  { name: "blitz-hud", path: "/lab/kit/panels?part=hud", mark: "hud", sizes: DESKTOPS, rule: hudClearanceProblems },
  { name: "blitz-left-column", path: "/lab/kit/panels", mark: "left-column" },
  { name: "blitz-top-header", path: "/lab/kit/panels?part=top-header", mark: "top-header" },
  { name: "blitz-tile-army", path: "/lab/kit/panels?tile=army", mark: "tile" },
  { name: "blitz-tile-empty", path: "/lab/kit/panels?tile=empty", mark: "tile" },
  { name: "blitz-realm-castle", path: "/lab/kit/panels?tile=castle", mark: "tile" },
  { name: "blitz-realm-building", path: "/lab/kit/panels?tile=building", mark: "tile" },
  { name: "blitz-realm-production", path: "/lab/kit/panels?tile=production", mark: "tile" },
  { name: "blitz-next-up-and-events", path: "/lab/kit/guidance", mark: "next-up" },
  { name: "frontier-hud", path: "/lab/kit/hud/idle", mark: "frontier" },
  { name: "frontier-merge", path: "/lab/kit/hud/merge", mark: "frontier-merge", sizes: [VIEWPORT, [390, 844]] },
  { name: "frontier-selected", path: "/lab/kit/hud/selected", mark: "frontier" },
  { name: "frontier-menu", path: "/lab/kit/hud/menu", mark: "frontier" },
  { name: "frontier-explore", path: "/lab/kit/hud/explore", mark: "frontier" },
  { name: "frontier-stores", path: "/lab/kit/hud/stores", mark: "frontier" },
  { name: "frontier-site-camp", path: "/lab/kit/hud/site-camp", mark: "frontier" },
  { name: "frontier-fight-won", path: "/lab/kit/hud/fight-won", mark: "frontier" },
  { name: "frontier-army-refill", path: "/lab/kit/hud/army-refill", mark: "frontier" },
  {
    name: "frontier-research",
    path: "/lab/kit/hud/research",
    mark: "frontier",
    sizes: [
      [1600, 900],
      [390, 844],
    ],
  },
];

/**
 * The lab pages the layout is held on: the one desktop HUD as each mode and viewer meets it (a Blitz player with the
 * Build order panel in the rail, a Blitz spectator while the game runs and once it has finished, a Frontier player), then Frontier's own moments on it (an
 * army picked, a camp's card, Deploy, Research, Next up on the deploy, the purse with Next up, the owner's
 * Kingdom with labor to claim, the last hour, a sheet).
 */
const HUD_LAYOUT_PAGES = [
  "unified/blitz",
  "unified/blitz-spectator",
  "unified/blitz-finished",
  "unified/frontier",
  "hud/selected",
  "hud/site-camp",
  "hud/deploy",
  "hud/research",
  "hud/next-up-deploy",
  "hud/purse-next-up",
  "hud/realm-claim",
  "hud/last-hour",
  "hud/stores",
];

const holdHudLayout = ({ baseUrl, out, run }) => {
  const results = [];
  for (const [width, height] of DESKTOPS) {
    run("set", "viewport", String(width), String(height));
    for (const page of HUD_LAYOUT_PAGES) {
      run("open", `${baseUrl}/lab/kit/${page}`, "--ignore-https-errors");
      // The HUD mounts once the lab's game has opened its shard: wait for its column, then let the parts settle.
      run("wait", "[data-hud-column]");
      run("wait", HUD_SETTLE_MS);
      const verdict = judgeHudLayout(JSON.parse(JSON.parse(run("eval", HUD_LAYOUT_EXPRESSION))));
      run("screenshot", join(out, `hud-layout-${width}x${height}-${page.replace("/", "-")}.png`));
      results.push({ size: `${width}x${height}`, page, ...verdict });
      console.log(`${verdict.status} ${width}x${height} ${page}${verdict.reason ? `: ${verdict.reason}` : ""}`);
    }
  }
  writeFileSync(join(out, "hud-layout.json"), JSON.stringify(results, null, 2));
  return results.filter(({ status }) => status !== "completed");
};

/** How long the HUD's parts take to settle once its column is drawn (panels that size to what they read). */
const HUD_SETTLE_MS = "1500";

const main = () => {
  const { values } = parseArgs({
    options: {
      "base-url": { type: "string" },
      out: { type: "string" },
      only: { type: "string" },
      "hud-layout": { type: "boolean" },
    },
  });
  if (!values["base-url"] || !values.out) throw new Error("Usage: --base-url <url> --out <dir> [--only a,b]");
  const only = values.only?.split(",");
  const surfaces = only ? SURFACES.filter(({ name }) => only.includes(name)) : SURFACES;
  mkdirSync(values.out, { recursive: true });
  const session = `hud-lab-${process.pid}`;
  const run = (...args) => runAgentBrowser(session, args);
  if (values["hud-layout"]) {
    let faults;
    try {
      faults = holdHudLayout({ baseUrl: values["base-url"], out: values.out, run });
    } finally {
      run("close");
    }
    if (faults.length > 0) {
      console.error(`HUD layout faults: ${faults.length}`);
      process.exit(1);
    }
    return;
  }
  const missing = [];
  const broken = [];
  const interactions = [];
  try {
    for (const { name, path, mark, sizes = [VIEWPORT], rule } of surfaces) {
      for (const [width, height] of sizes) {
        const shot = sizes.length > 1 ? `${name}-${width}x${height}` : name;
        run("set", "viewport", String(width), String(height));
        run("open", `${values["base-url"]}${path}`, "--ignore-https-errors");
        run("wait", SETTLE_MS);
        if (name === "frontier-merge") run("wait", '[role="dialog"][aria-label="Transfer troops"]');
        const drawn = JSON.parse(run("eval", `Boolean(document.querySelector('[data-lab="${mark}"]'))`));
        if (!drawn) missing.push(shot);
        run("screenshot", join(values.out, `${shot}.png`));
        if (name === "frontier-merge") {
          run("find", "role", "button", "click", "--name", "Merge into Army 2", "--exact");
          run("wait", "--text", "Confirm merge into Army 2");

          // What the sheet shows: its text, the XP struck out on the card of the army a merge empties, and whether the
          // confirmation and its loss line stand in view.
          const readSheet = () =>
            JSON.parse(
              run(
                "eval",
                `(() => {
            const sheet = document.querySelector('[role="dialog"]');
            const button = [...sheet.querySelectorAll('button')].find(b => b.textContent === 'Confirm merge into Army 2');
            const visible = element => {
              const box = element?.getBoundingClientRect();
              return !!box && box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
            };
            return { text: sheet.textContent, struck: sheet.querySelector('s')?.textContent ?? null, reachable: visible(button), lossVisible: visible(sheet.querySelector('.ui-notice')) };
          })()`,
              ),
            );
          const confirmed = readSheet();
          writeFileSync(join(values.out, `${shot}-confirmation.json`), JSON.stringify(confirmed, null, 2));
          if (
            !confirmed.reachable ||
            !confirmed.lossVisible ||
            confirmed.struck !== "100 XP" ||
            !confirmed.text.includes("Army 1 loses 200 progression value")
          ) {
            throw new Error(`${shot}: the army leaving, its exact loss and a reachable confirmation must be visible`);
          }
          run("screenshot", join(values.out, `${shot}-confirm.png`));
          // The slider moved one step, by key: Army 1 keeps one troop, so the merge becomes a move.
          run("focus", 'input[type="range"]');
          run("press", "ArrowRight");
          run("wait", "--text", "Move 599 to Army 2");
          const partial = readSheet();
          if (partial.text.includes("Confirm merge") || partial.struck !== null) {
            throw new Error(`${shot}: changing the split must clear confirmation and the merge's losses`);
          }
          // The slider's far end: everything goes the other way, into Army 1.
          run("press", "End");
          run("wait", "--text", "Merge into Army 1");
          const reversed = readSheet();
          if (reversed.struck !== "0 XP") {
            throw new Error(`${shot}: both merge directions must remain available`);
          }
          run("screenshot", join(values.out, `${shot}-reversed.png`));
          interactions.push({ shot, confirmed, partial, reversed });
          writeFileSync(join(values.out, "merge-interactions.json"), JSON.stringify(interactions, null, 2));
        }
        const problems = rule ? rule(JSON.parse(run("eval", READ_HUD_BOXES))) : [];
        problems.forEach((problem) => broken.push(`${shot}: ${problem}`));
        console.log(`${!drawn ? "MISSING" : problems.length > 0 ? "BROKEN" : "shot"} ${shot}`);
      }
    }
  } finally {
    run("close");
  }
  if (missing.length > 0) console.error(`Not drawn: ${missing.join(", ")}`);
  broken.forEach((line) => console.error(line));
  if (missing.length > 0 || broken.length > 0) process.exit(1);
};

main();
