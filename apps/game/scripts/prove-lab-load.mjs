/**
 * What opening each lab page costs: every page opened twice in a fresh tab of one browser (the first open also pays the
 * dev server's transform; the second is what a later visit costs), and for each open the JavaScript files and bytes it
 * fetched, when its largest paint landed, and whether it drew a 3D canvas, with a screenshot of the second open.
 *
 *   pnpm --dir apps/game prove:lab-load --port 4199 --out <fresh-dir> [--base-url <url>] [--routes /lab/kit,/lab/studio]
 *
 * The record is `<out>/run-<start>/lab-load.json`; a page that never draws is a problem and the command exits 1.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { withDevClient } from "./lib/dev-client.mjs";
import { runProof, sleep, waitFor } from "./prove-run.mjs";

/** The lab's pages, room by room as `src/lab/rooms.ts` lists them, then the HUD room's frames. */
const ROUTES = [
  "/lab/kit",
  "/lab/kit/tokens",
  "/lab/kit/app",
  "/lab/kit/shell",
  "/lab/kit/app-art",
  "/lab/kit/icons",
  "/lab/kit/resource-icons",
  "/lab/kit/reward-chests",
  "/lab/kit/words",
  "/lab/motion",
  "/lab/hud",
  "/lab/app/home",
  "/lab/day-end",
  "/lab/endgame",
  "/lab/relic-chest",
  "/lab/map-labels",
  "/lab/terrain",
  "/lab/terrain-props",
  "/lab/models",
  "/lab/characters",
  "/lab/rewards",
  "/lab/world-fx",
  "/lab/character-benchmark",
  "/lab/world",
  "/lab/chunks",
  "/lab/terrain-benchmark",
  "/lab/data",
  "/lab/studio",
  "/lab/footage",
  "/lab/kit/hud/idle",
  "/lab/kit/unified/frontier",
  "/lab/kit/panels",
];
const READY_MS = 90_000;
/** How long a page may keep fetching after it first draws: a lazy part it opens on its own lands in the count. */
const SETTLE_MS = 3_000;

const { values } = parseArgs({
  options: {
    "base-url": { type: "string" },
    port: { type: "string", default: "4199" },
    out: { type: "string" },
    routes: { type: "string" },
  },
});
if (!values.out) throw new Error("--out <fresh-dir> is required");
mkdirSync(values.out, { recursive: true });
const routes = values.routes ? values.routes.split(",") : ROUTES;
/** The browser keeps 250 resource timings by default, fewer than one dev page fetches; this keeps them all. */
const INIT = join(values.out, "keep-timings.js");
writeFileSync(INIT, "performance.setResourceTimingBufferSize(1000000);\n");

/** Drawn: the lab's tool area holds something other than its loading line. */
const DRAWN = `(() => {
  const tool = document.querySelector(".lab-tool");
  return tool !== null && tool.querySelector(".lab-loading") === null && tool.childElementCount > 0;
})()`;

/** The page's cost so far, from the browser's own resource and paint timings. */
const COST = `(async () => {
  const scripts = performance
    .getEntriesByType("resource")
    .filter((entry) => entry.initiatorType === "script" || /\\.(m?[jt]sx?)(\\?|$)/.test(new URL(entry.name).pathname));
  // The client's own modules, apart from the libraries the dev server bundles once (node_modules/.vite).
  const own = scripts.filter((entry) => new URL(entry.name).pathname.startsWith("/src/"));
  const paint = await new Promise((done) => {
    let last = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => (last = entry.startTime))).observe({
      type: "largest-contentful-paint",
      buffered: true,
    });
    setTimeout(() => done(last), 100);
  });
  return {
    scripts: scripts.length,
    ownModules: own.length,
    kilobytes: Math.round(scripts.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0) / 1024),
    lastScriptMs: Math.round(Math.max(0, ...scripts.map((entry) => entry.responseEnd))),
    largestPaintMs: Math.round(paint),
    canvas: document.querySelector("canvas") !== null,
  };
})()`;

const open = async (b, url, shot) => {
  b.run("open", "about:blank", "--init-script", INIT);
  b.run("open", url, "--ignore-https-errors");
  const drawn = await waitFor(b, DRAWN, READY_MS);
  if (drawn) await sleep(SETTLE_MS);
  if (drawn && shot) b.run("screenshot", shot);
  return { drawn, ...(drawn ? b.evaluate(COST) : {}) };
};

await withDevClient({ base: values["base-url"], port: values.port, out: values.out }, (baseUrl) =>
  runProof(
    { parent: values.out, name: "lab-load", baseUrl, where: (record) => ({ route: record.route }) },
    async (b, out, records) => {
      for (const route of routes) {
        const first = await open(b, `${baseUrl}${route}`);
        const again = await open(b, `${baseUrl}${route}`, join(out, `${route.slice(1).replaceAll("/", "-")}.png`));
        records.push({ route, ready: first.drawn && again.drawn, presses: [], first, again });
        console.log(route, JSON.stringify(again));
      }
    },
  ),
);
