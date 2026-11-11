import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { trialLeaks } from "./check-map-client-isolation.mjs";

/** A build: each chunk's code, and the sources its map names. */
function build(chunks) {
  const dist = mkdtempSync(join(tmpdir(), "map-client-isolation-"));
  mkdirSync(join(dist, "assets"));
  for (const [name, { code, sources }] of Object.entries(chunks)) {
    writeFileSync(join(dist, "assets", name), code);
    if (sources) writeFileSync(join(dist, "assets", `${name}.map`), JSON.stringify({ sources }));
  }
  return dist;
}

const LOADER = "../../src/map-client/lazy-map-renderer.ts";
const FLAG = "../../src/map-client/map-client-flag.ts";
const RENDERER = "../../src/map-client/map-renderer.ts";
const WRAPPER = "../../src/map-client/renderer/map_client.js";
const trial = {
  "map-renderer.js": {
    code: 'import{a}from"./three.js";const load=()=>import("./map_client.js");',
    sources: [RENDERER, "../../node_modules/meshoptimizer/meshopt_simplifier.js"],
  },
  "map_client.js": { code: "export{}", sources: [WRAPPER] },
  "three.js": { code: "export const a=1;", sources: ["../../node_modules/three/src/Three.js"] },
};

test("a build whose trial sits in chunks of its own, fetched only by its loader, leaks nothing", () => {
  const dist = build({
    ...trial,
    "main.js": { code: 'const play=()=>import("./doorway.js");', sources: ["../../src/main.tsx", FLAG] },
    "doorway.js": {
      code: 'import{a}from"./three.js";const map=()=>import("./map-renderer.js");',
      sources: ["../../src/doorway-screen.tsx", LOADER],
    },
  });

  assert.deepEqual(trialLeaks(dist), []);
});

test("the trial bundled into a chunk the game loads anyway is a leak", () => {
  const dist = build({
    "main.js": { code: 'const play=()=>import("./doorway.js");', sources: ["../../src/main.tsx", FLAG] },
    "doorway.js": { code: "export{}", sources: ["../../src/doorway-screen.tsx", RENDERER] },
  });

  assert.deepEqual(trialLeaks(dist), [
    "doorway.js: holds the trial beside ../../src/doorway-screen.tsx",
    "main.js: fetches the trial's doorway.js and is not its loader",
  ]);
});

test("a static import of a trial chunk from the rest of the app is a leak", () => {
  const dist = build({
    ...trial,
    "doorway.js": { code: 'import{b}from"./map-renderer.js";', sources: ["../../src/doorway-screen.tsx", LOADER] },
  });

  assert.deepEqual(trialLeaks(dist), ["doorway.js: imports the trial's map-renderer.js statically"]);
});

test("a chunk that fetches the trial and is not its loader is a leak", () => {
  const dist = build({
    ...trial,
    "minimap.js": { code: 'const map=()=>import("./map-renderer.js");', sources: ["../../src/minimap.tsx"] },
  });

  assert.deepEqual(trialLeaks(dist), ["minimap.js: fetches the trial's map-renderer.js and is not its loader"]);
});

test("a file with no source map, as a copied decoder is, is not judged", () => {
  const dist = build({
    ...trial,
    "doorway.js": { code: 'const map=()=>import("./map-renderer.js");', sources: [LOADER] },
    "draco_decoder.js": { code: "var Module={}" },
  });

  assert.deepEqual(trialLeaks(dist), []);
});

test("a build with no trial in it is not a pass", () => {
  const dist = build({ "main.js": { code: "export{}", sources: ["../../src/main.tsx"] } });

  assert.deepEqual(trialLeaks(dist), ["No chunk holds the map client under trial: the check has nothing to judge"]);
});
