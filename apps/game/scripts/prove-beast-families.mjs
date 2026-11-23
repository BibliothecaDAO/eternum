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

const FAMILIES = [
  { id: "herd", layer: 0 },
  { id: "band", layer: 1 },
  { id: "camp", layer: 0 },
  { id: "rift", layer: 1 },
  { id: "ruin", layer: 2 },
  { id: "deep", layer: 3 },
];

const FAMILY_ACTIONS = [
  { action: "idle", durationMs: 2200 },
  { action: "attack", durationMs: 2600 },
  { action: "hit", durationMs: 1800 },
  { action: "death", durationMs: 2200 },
];

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

function recordFamilyReel(browser, family, camera, suffix, fps = 24) {
  const name = `family-${family.id}-${suffix}`;
  const webmPath = join(out, `${name}.webm`);
  const mp4Path = join(out, `${name}.mp4`);
  browser.run([
    "eval",
    `window.__beastMotionLab.setState(${JSON.stringify({
      mode: "families",
      family: family.id,
      action: "idle",
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
    for (const step of FAMILY_ACTIONS) {
      browser.run(["eval", `window.__beastMotionLab.setState(${JSON.stringify({ action: step.action, paused: false })})`]);
      browser.run(["wait", String(step.durationMs)]);
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

    for (const family of FAMILIES) {
      clips.push(recordFamilyReel(browser, family, "threeQuarter", "desktop"));
    }

    browser.run(["set", "viewport", "390", "844"]);
    for (const family of FAMILIES) {
      clips.push(recordFamilyReel(browser, family, "phoneMap", "phone"));
    }

    writeFileSync(
      join(out, "summary.json"),
      JSON.stringify({ capturedAt: new Date().toISOString(), clips }, null, 2),
    );
    console.log(`Beast family proof complete: ${clips.length} clips in ${out}`);
  } finally {
    browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
