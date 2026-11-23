import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);

const out = option("--out", join(tmpdir(), "troop-motion-proof-" + Date.now()));
const port = option("--port", "4427");
mkdirSync(out, { recursive: true });

const KNIGHT_FILES = ["skin.glb", "sword.glb", "shield.glb"];
const PUBLIC_TMP_DIR = fileURLToPath(new URL("../public/.tmp-shipped-knight", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const SKIN_REPO_PATH = "apps/game/public/models/characters/t1-knight-default/near/skin.glb";

function resolveShippedKnightRef() {
  try {
    const commits = execFileSync("git", ["log", "--format=%H", "-n", "12", "--", SKIN_REPO_PATH], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const hash of commits) {
      const size = Number(
        execFileSync("git", ["cat-file", "-s", `${hash}:${SKIN_REPO_PATH}`], {
          cwd: REPO_ROOT,
          encoding: "utf8",
        }).trim(),
      );
      if (size > 2_000_000) return hash;
    }
  } catch {}
  for (const ref of ["feat/frontier-s1", "origin/feat/frontier-s1"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", ref], { cwd: REPO_ROOT, stdio: "ignore" });
      return ref;
    } catch {}
  }
  return null;
}

function stageShippedKnightFiles() {
  const ref = resolveShippedKnightRef();
  if (!ref) return false;
  mkdirSync(PUBLIC_TMP_DIR, { recursive: true });
  for (const file of KNIGHT_FILES) {
    const gitPath = `${ref}:apps/game/public/models/characters/t1-knight-default/near/${file}`;
    const content = execFileSync("git", ["show", gitPath], { cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 });
    writeFileSync(join(PUBLIC_TMP_DIR, file), content);
  }
  return true;
}

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

function recordActionClip(browser, name, state, durationMs, fps = 24) {
  const webmPath = join(out, `${name}.webm`);
  const mp4Path = join(out, `${name}.mp4`);
  browser.run(["eval", `window.__troopMotionLab.setState(${JSON.stringify(state)})`]);
  browser.run(["wait", "220"]);
  browser.run(["record", "start", webmPath, "--fps", String(fps)]);
  try {
    browser.run(["wait", String(durationMs)]);
  } finally {
    browser.run(["record", "stop"]);
  }
  transcodeClip(webmPath, mp4Path);
  return `${name}.mp4`;
}

const profile = mkdtempSync(join(tmpdir(), "troop-motion-proof-"));
const browser = createBrowserSession("troop-motion-" + Date.now(), { profile, headed: false });
const hasShippedKnight = stageShippedKnightFiles();

try {
  await withDevClient({ base: option("--base-url", null), port, out }, async (baseUrl) => {
    try {
      const clips = [];
      const compareQuery = hasShippedKnight ? "&compare=1&shippedUrl=/.tmp-shipped-knight" : "&compare=0";

      browser.run(["set", "viewport", "1280", "720"]);
      browser.run([
        "open",
        `${baseUrl}/lab/troop-motion?capture=1&troop=knight&action=idle&camera=desktop${compareQuery}`,
      ]);
      browser.run([
        "wait",
        "--fn",
        "document.querySelector('[data-troop-motion-ready=\"true\"]') !== null && Boolean(window.__troopMotionLab?.ready)",
      ]);

      const meta = browser.read("window.__troopMotionLab.getMeta()");
      const troops = meta.troops;
      const actions = meta.actions;

      for (const troop of troops) {
        const compare = troop === "knight" ? hasShippedKnight : true;
        for (const action of actions) {
          const duration = action === "attack" ? 3000 : action === "death" ? 2500 : 2400;
          clips.push(
            recordActionClip(
              browser,
              `${troop}-desktop-${action}`,
              { troop, action, camera: "desktop", compareShipped: compare },
              duration,
            ),
          );
        }
        clips.push(
          recordActionClip(
            browser,
            `${troop}-reel-desktop`,
            { troop, action: "reel", camera: "desktop", compareShipped: false },
            11800,
          ),
        );
      }

      browser.run(["set", "viewport", "390", "844"]);
      for (const troop of troops) {
        const compare = troop === "knight" ? hasShippedKnight : true;
        for (const action of actions) {
          const duration = action === "attack" ? 3000 : action === "death" ? 2500 : 2400;
          clips.push(
            recordActionClip(
              browser,
              `${troop}-phone-${action}`,
              { troop, action, camera: "phone", compareShipped: compare },
              duration,
            ),
          );
        }
      }

      const stats = JSON.parse(browser.run(["eval", "JSON.stringify(window.__troopMotionLab.getStats())"]));
      writeFileSync(
        join(out, "summary.json"),
        JSON.stringify(
          { capturedAt: new Date().toISOString(), comparedWithShipped: hasShippedKnight, clips, stats },
          null,
          2,
        ),
      );
      console.log(`Troop motion proof complete: ${clips.length} clips in ${out}`);
    } finally {
      browser.close();
      rmSync(profile, { recursive: true, force: true });
    }
  });
} finally {
  rmSync(PUBLIC_TMP_DIR, { recursive: true, force: true });
}
