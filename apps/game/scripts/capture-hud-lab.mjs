#!/usr/bin/env node
/**
 * The HUD sheet migration's before-and-after: every HUD surface the lab draws, shot at 1920×1080 (the desktop HUD's
 * stage also at 1280×720 and 1440×900), one picture per surface and size. Against a running dev build (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game capture:hud-lab --base-url https://127.0.0.1:<port> --out <dir> [--only <surface>,...]
 *
 * Run it on the commit before a change and again after; the two directories hold the same file names. A surface the
 * page does not draw (its `[data-lab]` mark missing) fails the run, so a broken surface never passes as a picture. The
 * desktop HUD's stage is also held to its bottom-left rule at each size (scripts/hud-sheet/clearance.mjs): the minimap in
 * the left column's corner, the foot between the columns.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { hudClearanceProblems, READ_HUD_BOXES } from "../../../scripts/hud-sheet/clearance.mjs";
import { runAgentBrowser } from "./run-renderer-scene-smoke.mjs";

const VIEWPORT = [1920, 1080];
/** The desktop sizes the HUD's layout is held at: a small laptop, a common laptop, a full HD screen. */
const DESKTOPS = [[1280, 720], [1440, 900], VIEWPORT];
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
  { name: "frontier-selected", path: "/lab/kit/hud/selected", mark: "frontier" },
  { name: "frontier-menu", path: "/lab/kit/hud/menu", mark: "frontier" },
  { name: "frontier-explore", path: "/lab/kit/hud/explore", mark: "frontier" },
  { name: "frontier-stores", path: "/lab/kit/hud/stores", mark: "frontier" },
  { name: "frontier-site-camp", path: "/lab/kit/hud/site-camp", mark: "frontier" },
  { name: "frontier-fight-won", path: "/lab/kit/hud/fight-won", mark: "frontier" },
  { name: "frontier-army", path: "/lab/kit/hud/army-cheap", mark: "frontier" },
  { name: "frontier-army-refill", path: "/lab/kit/hud/army-refill", mark: "frontier" },
];

const main = () => {
  const { values } = parseArgs({
    options: { "base-url": { type: "string" }, out: { type: "string" }, only: { type: "string" } },
  });
  if (!values["base-url"] || !values.out) throw new Error("Usage: --base-url <url> --out <dir> [--only a,b]");
  const only = values.only?.split(",");
  const surfaces = only ? SURFACES.filter(({ name }) => only.includes(name)) : SURFACES;
  mkdirSync(values.out, { recursive: true });
  const session = `hud-lab-${process.pid}`;
  const run = (...args) => runAgentBrowser(session, args);
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
