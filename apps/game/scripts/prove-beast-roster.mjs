import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";
import { assertBrowserClean, parseOption, transcodeClip } from "./lib/motion-proof.mjs";

const out = parseOption("--out", join(tmpdir(), "beast-roster-proof-" + Date.now()));
const port = parseOption("--port", "4431");
const samplesPerBench = Number(parseOption("--samples", "45"));
const warmupFrames = Number(parseOption("--warmup", "15"));
const actionDurationMs = Number(parseOption("--action-ms", "1900"));
mkdirSync(out, { recursive: true });

function waitForSpeciesReady(browser) {
  browser.run(["wait", "--fn", "Boolean(window.__beastMotionLab?.isSpeciesReady?.())"]);
  browser.run(["wait", "160"]);
}

function recordBeastWayReel(browser, member, way, actions, fps = 24) {
  const name = `beast-${member.species}-${way}`;
  const webmPath = join(out, `${name}.webm`);
  const mp4Path = join(out, `${name}.mp4`);
  browser.run([
    "eval",
    `window.__beastMotionLab.setState(${JSON.stringify({
      mode: "bench",
      species: member.species,
      way,
      count: 1,
      action: actions[0],
      layer: member.layer,
      phoenix: true,
      paused: false,
      camera: "close",
    })})`,
  ]);
  waitForSpeciesReady(browser);
  browser.run(["record", "start", webmPath, "--fps", String(fps)]);
  try {
    for (const action of actions) {
      browser.run(["eval", `window.__beastMotionLab.setState(${JSON.stringify({ action, paused: false })})`]);
      browser.run(["wait", String(actionDurationMs)]);
    }
  } finally {
    browser.run(["record", "stop"]);
  }
  transcodeClip(webmPath, mp4Path);
  return `${name}.mp4`;
}

function measureBeastAt20OnPhone(browser, member, way) {
  browser.run([
    "eval",
    `window.__beastMotionLab.setState(${JSON.stringify({
      mode: "bench",
      species: member.species,
      way,
      count: 20,
      action: "walk",
      layer: member.layer,
      phoenix: true,
      paused: false,
      camera: "threeQuarter",
    })})`,
  ]);
  waitForSpeciesReady(browser);
  browser.run([
    "eval",
    `window.__bmMeasure = null; window.__beastMotionLab.measure(${samplesPerBench}, ${warmupFrames}).then((r) => { window.__bmMeasure = r; });`,
  ]);
  browser.run(["wait", "--fn", "window.__bmMeasure !== null"]);
  return browser.read("window.__bmMeasure");
}

const profile = mkdtempSync(join(tmpdir(), "beast-roster-proof-"));
const browser = createBrowserSession("beast-roster-" + Date.now(), { profile, headed: false });

await withDevClient({ base: parseOption("--base-url", null), port, out }, async (baseUrl) => {
  try {
    browser.run(["set", "viewport", "960", "540"]);
    browser.run(["open", `${baseUrl}/lab/beast-motion?capture=1&mode=bench&way=maths&count=1&camera=close`]);
    browser.run([
      "wait",
      "--fn",
      "document.querySelector('[data-beast-motion-ready=\"true\"]') !== null && Boolean(window.__beastMotionLab)",
    ]);

    const meta = browser.read("window.__beastMotionLab.getMeta()");
    const actions = meta.actions;
    const roster = meta.roster;
    const ways = meta.ways.filter((way) => way !== "rig");

    const results = [];
    for (const family of roster) {
      for (const member of family.members) {
        const clips = {};
        for (const way of ways) {
          clips[way] = recordBeastWayReel(browser, member, way, actions);
        }
        const stats = browser.read("window.__beastMotionLab.getStats()");
        results.push({
          familyId: family.id,
          familyLabel: family.label,
          species: member.species,
          name: member.name,
          layer: member.layer,
          path: member.path,
          trianglesPerBeast: stats.trianglesPerBeast,
          clips,
          phone20: {},
        });
      }
    }

    browser.run(["set", "viewport", "390", "844"]);
    for (const entry of results) {
      for (const way of ways) {
        entry.phone20[way] = measureBeastAt20OnPhone(browser, entry, way);
      }
    }

    const finalStats = assertBrowserClean(browser, "__beastMotionLab");
    writeFileSync(
      join(out, "roster-measurements.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          viewportClip: { width: 960, height: 540 },
          viewportPhone: { width: 390, height: 844 },
          actions,
          ways,
          beastCount: results.length,
          beasts: results,
          stats: finalStats,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`Beast roster proof complete: ${results.length * ways.length} clips across ${results.length} beasts in ${out}`);
  } finally {
    browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
