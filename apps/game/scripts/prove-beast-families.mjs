import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);

const out = option("--out", join(tmpdir(), "beast-families-proof-" + Date.now()));
const port = option("--port", "4429");
mkdirSync(out, { recursive: true });

const FAMILY_ACTION_DURATIONS_MS = {
  idle: 2200,
  attack: 2600,
  hit: 1800,
  death: 2200,
};

function transcodeClip(webmPath, mp4Path) {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webmPath,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      "-an",
      mp4Path,
    ],
    { stdio: "ignore" },
  );
  unlinkSync(webmPath);
}

function recordFamilyReel(browser, family, actions, camera, suffix, fps = 24) {
  const name = `family-${family.id}-${suffix}`;
  const webmPath = join(out, `${name}.webm`);
  const mp4Path = join(out, `${name}.mp4`);
  browser.run([
    "eval",
    `window.__beastMotionLab.setState(${JSON.stringify({
      mode: "families",
      family: family.id,
      action: actions[0],
      layer: family.layer,
      phoenix: true,
      paused: false,
      camera,
    })})`,
  ]);
  browser.run(["wait", "--fn", "Boolean(window.__beastMotionLab?.isFamilyReady?.())"]);
  browser.run(["wait", "220"]);
  browser.run(["record", "start", webmPath, "--fps", String(fps)]);
  try {
    for (const action of actions) {
      browser.run(["eval", `window.__beastMotionLab.setState(${JSON.stringify({ action, paused: false })})`]);
      browser.run(["wait", String(FAMILY_ACTION_DURATIONS_MS[action] ?? 2200)]);
    }
  } finally {
    browser.run(["record", "stop"]);
  }
  transcodeClip(webmPath, mp4Path);
  return `${name}.mp4`;
}

const profile = mkdtempSync(join(tmpdir(), "beast-families-proof-"));
const browser = createBrowserSession("beast-families-" + Date.now(), { profile, headed: false });

await withDevClient({ base: option("--base-url", null), port, out }, async (baseUrl) => {
  try {
    const clips = [];
    browser.run(["set", "viewport", "1280", "720"]);
    browser.run(["open", `${baseUrl}/lab/beast-motion?capture=1&mode=families&family=herd&layer=0`]);
    browser.run([
      "wait",
      "--fn",
      "document.querySelector('[data-beast-motion-ready=\"true\"]') !== null && Boolean(window.__beastMotionLab)",
    ]);

    const meta = browser.read("window.__beastMotionLab.getMeta()");
    const families = meta.families;
    const familyActions = meta.actions.filter((action) => action !== "walk");

    for (const family of families) {
      clips.push(recordFamilyReel(browser, family, familyActions, "threeQuarter", "desktop"));
    }

    browser.run(["set", "viewport", "390", "844"]);
    for (const family of families) {
      clips.push(recordFamilyReel(browser, family, familyActions, "phoneMap", "phone"));
    }

    writeFileSync(join(out, "summary.json"), JSON.stringify({ capturedAt: new Date().toISOString(), clips }, null, 2));
    console.log(`Beast family proof complete: ${clips.length} clips in ${out}`);
  } finally {
    browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
