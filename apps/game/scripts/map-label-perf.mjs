#!/usr/bin/env node
// The map plates' frame cost on the machine's GPU: opens the map label lab (/lab/map-labels) with `measure=1` at
// 1920×1080, once per lab query, renderer mode and iteration, waits for the eight-second camera pan the lab publishes on
// `window.__mapLabelPerf`, and writes every run, the renderer the page got and the machine's load into a new directory.
//
//   node scripts/map-label-perf.mjs --base-url https://127.0.0.1:4198 --out <dir> --query "busy=1" [--query …]
//     [--renderer-modes webgpu-auto,webgpu-force-webgl] [--iterations 3]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { join } from "node:path";

// As the client playtest opens its browser (the GPU through Vulkan, WebGPU on), with the frame rate unlocked so a frame
// interval is the frame's cost, not the display's refresh.
const BROWSER_ARGS = [
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--use-angle=vulkan",
  "--enable-features=Vulkan",
  "--enable-unsafe-webgpu",
  "--disable-gpu-vsync",
  "--disable-frame-rate-limit",
];
const VIEWPORT = { width: 1920, height: 1080 };

const readOptions = (argv) => {
  const values = (name) => argv.flatMap((arg, index) => (arg === name ? [argv[index + 1]] : []));
  const value = (name, fallback) => values(name)[0] ?? fallback;
  const queries = values("--query");
  if (!value("--base-url") || !value("--out") || queries.length === 0)
    throw new Error("usage: --base-url <url> --out <dir> --query <lab query> [--query …]");
  return {
    baseUrl: value("--base-url"),
    out: join(value("--out"), new Date().toISOString().replace(/[:.]/g, "-")),
    queries,
    rendererModes: value("--renderer-modes", "webgpu-auto,webgpu-force-webgl").split(","),
    iterations: Number(value("--iterations", "3")),
  };
};

const browser =
  (session) =>
  (...args) =>
    execFileSync("npx", ["-y", "agent-browser", "--session", session, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One run: a fresh browser on the lab, until the pan's numbers are published or two minutes pass. */
const measure = async ({ baseUrl, out }, query, rendererMode, iteration) => {
  const label = `${query.replace(/[^a-z0-9]+/gi, "-")}-${rendererMode}-${iteration}`;
  const run = browser(`map-label-perf-${Date.now().toString(36)}`);
  const load = { before: loadavg()[0] };
  try {
    run("open", "about:blank", "--ignore-https-errors", "--args", BROWSER_ARGS.join(","));
    run("set", "viewport", String(VIEWPORT.width), String(VIEWPORT.height));
    run("open", `${baseUrl}/lab/map-labels?capture=1&measure=1&rendererMode=${rendererMode}&${query}`);
    for (let waited = 0; waited < 120_000; waited += 2_000) {
      await sleep(2_000);
      const published = run("eval", "JSON.stringify(window.__mapLabelPerf ?? null)");
      const perf = JSON.parse(JSON.parse(published));
      if (perf) {
        const gpu = JSON.parse(
          run(
            "eval",
            "(() => { const gl = document.createElement('canvas').getContext('webgl2'); const info = gl && gl.getExtension('WEBGL_debug_renderer_info'); return JSON.stringify(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null); })()",
          ),
        );
        run("screenshot", join(out, `${label}.png`));
        return {
          query,
          rendererMode,
          iteration,
          ...perf,
          gpu: JSON.parse(gpu),
          load: { ...load, after: loadavg()[0] },
        };
      }
    }
    return { query, rendererMode, iteration, error: "no numbers published in two minutes", load };
  } finally {
    try {
      run("close");
    } catch {
      // A browser that already left has nothing to close.
    }
  }
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const main = async () => {
  const options = readOptions(process.argv.slice(2));
  mkdirSync(options.out, { recursive: true });
  const runs = [];
  for (const query of options.queries)
    for (const rendererMode of options.rendererModes)
      for (let iteration = 1; iteration <= options.iterations; iteration++) {
        const result = await measure(options, query, rendererMode, iteration);
        runs.push(result);
        console.log(JSON.stringify(result));
      }
  const summary = options.queries.flatMap((query) =>
    options.rendererModes.map((rendererMode) => {
      const done = runs.filter((run) => run.query === query && run.rendererMode === rendererMode && !run.error);
      return {
        query,
        rendererMode,
        runs: done.length,
        p50: done.length
          ? {
              median: median(done.map((run) => run.p50)),
              min: Math.min(...done.map((run) => run.p50)),
              max: Math.max(...done.map((run) => run.p50)),
            }
          : null,
        p95: done.length
          ? {
              median: median(done.map((run) => run.p95)),
              min: Math.min(...done.map((run) => run.p95)),
              max: Math.max(...done.map((run) => run.p95)),
            }
          : null,
        labelWorkP50: done.length ? median(done.map((run) => run.labelWorkP50)) : null,
        labelWorkP95: done.length ? median(done.map((run) => run.labelWorkP95)) : null,
        domNodes: done[0]?.domNodes ?? null,
        plates: done[0]?.plates ?? null,
        gpu: done[0]?.gpu ?? null,
        maxLoad: Math.max(
          ...runs.filter((run) => run.query === query).map((run) => Math.max(run.load.before, run.load.after ?? 0)),
        ),
      };
    }),
  );
  writeFileSync(join(options.out, "map-label-perf.json"), JSON.stringify({ options, runs, summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${join(options.out, "map-label-perf.json")}`);
};

await main();
