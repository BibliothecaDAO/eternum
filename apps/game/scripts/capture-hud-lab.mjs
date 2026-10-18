#!/usr/bin/env node
/**
 * The HUD sheet migration's before-and-after: every HUD surface the lab draws, shot at 1920×1080, one picture per
 * surface. Against a running dev build (`pnpm --dir apps/game dev --host 127.0.0.1 --port <port>`):
 *
 *   pnpm --dir apps/game capture:hud-lab --base-url https://127.0.0.1:<port> --out <dir> [--only <surface>,...]
 *
 * Run it on the commit before a change and again after; the two directories hold the same file names. A surface the
 * page does not draw (its `[data-lab]` mark missing) fails the run, so a broken surface never passes as a picture.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { runAgentBrowser } from "./run-renderer-scene-smoke.mjs";

const VIEWPORT = ["1920", "1080"];
const SETTLE_MS = "1200";

/** Each surface: the lab page that draws it, and the mark the page puts on it. */
export const SURFACES = [
  { name: "blitz-left-column", path: "/lab/kit/panels", mark: "left-column" },
  { name: "blitz-top-header", path: "/lab/kit/panels?part=top-header", mark: "top-header" },
  { name: "blitz-tile-army", path: "/lab/kit/panels?tile=army", mark: "tile" },
  { name: "blitz-tile-empty", path: "/lab/kit/panels?tile=empty", mark: "tile" },
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
  try {
    run("set", "viewport", ...VIEWPORT);
    for (const { name, path, mark } of surfaces) {
      run("open", `${values["base-url"]}${path}`, "--ignore-https-errors");
      run("wait", SETTLE_MS);
      const drawn = JSON.parse(run("eval", `Boolean(document.querySelector('[data-lab="${mark}"]'))`));
      if (!drawn) missing.push(name);
      run("screenshot", join(values.out, `${name}.png`));
      console.log(`${drawn ? "shot" : "MISSING"} ${name}`);
    }
  } finally {
    run("close");
  }
  if (missing.length > 0) {
    console.error(`Not drawn: ${missing.join(", ")}`);
    process.exit(1);
  }
};

main();
