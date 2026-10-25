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
];

/**
 * The lab pages the layout is held on: the one desktop HUD as each mode and viewer meets it (a Blitz player with the
 * Build order panel in the rail, a Blitz spectator while the game runs and once it has finished, a Frontier player), then Frontier's own moments on it (an
 * army picked, a camp's card, Deploy, Research, Next up on the deploy, the purse with Next up, the last hour, a sheet).
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
  try {
    for (const { name, path, mark, sizes = [VIEWPORT], rule } of surfaces) {
      for (const [width, height] of sizes) {
        const shot = sizes.length > 1 ? `${name}-${width}x${height}` : name;
        run("set", "viewport", String(width), String(height));
        run("open", `${values["base-url"]}${path}`, "--ignore-https-errors");
        run("wait", SETTLE_MS);
        const drawn = JSON.parse(run("eval", `Boolean(document.querySelector('[data-lab="${mark}"]'))`));
        if (!drawn) missing.push(shot);
        run("screenshot", join(values.out, `${shot}.png`));
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
