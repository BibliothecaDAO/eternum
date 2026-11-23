import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);

const out = option("--out", join(tmpdir(), "troop-motion-proof-" + Date.now()));
const port = option("--port", "4427");
mkdirSync(out, { recursive: true });

const ACTIONS = ["idle", "march", "attack", "hit", "death"];
const KNIGHT_FILES = ["skin.glb", "sword.glb", "shield.glb"];

function resolveShippedKnightRef() {
  for (const ref of ["feat/frontier-s1", "origin/feat/frontier-s1"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", ref], { stdio: "ignore" });
      return ref;
    } catch {}
  }
  return null;
}

async function startShippedKnightServer() {
  const ref = resolveShippedKnightRef();
  if (!ref) return null;
  const blobs = new Map();
  for (const file of KNIGHT_FILES) {
    const gitPath = `${ref}:apps/game/public/models/characters/t1-knight-default/near/${file}`;
    const content = execFileSync("git", ["show", gitPath], { maxBuffer: 16 * 1024 * 1024 });
    blobs.set(`/${file}`, content);
  }
  const server = createServer((req, res) => {
    const pathname = (req.url || "/").split("?")[0];
    const body = blobs.get(pathname);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (!body) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "model/gltf-binary", "Content-Length": String(body.length) });
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
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
const shippedServer = await startShippedKnightServer();

try {
  await withDevClient({ base: option("--base-url", null), port, out }, async (baseUrl) => {
    try {
      const clips = [];
      const compareQuery = shippedServer
        ? `&compare=1&shippedUrl=${encodeURIComponent(shippedServer.url)}`
        : "&compare=0";

      browser.run(["set", "viewport", "1280", "720"]);
      browser.run(["open", `${baseUrl}/lab/troop-motion?capture=1&troop=knight&action=idle&camera=desktop${compareQuery}`]);
      browser.run([
        "wait",
        "--fn",
        "document.querySelector('[data-troop-motion-ready=\"true\"]') !== null && Boolean(window.__troopMotionLab?.ready)",
      ]);

      for (const action of ACTIONS) {
        const duration = action === "attack" ? 3100 : action === "death" ? 2600 : 2500;
        clips.push(
          recordActionClip(
            browser,
            `knight-desktop-${action}`,
            { action, camera: "desktop", compareShipped: Boolean(shippedServer) },
            duration,
          ),
        );
      }

      clips.push(
        recordActionClip(
          browser,
          "knight-new-reel-desktop",
          { action: "reel", camera: "desktop", compareShipped: false },
          11800,
        ),
      );

      browser.run(["set", "viewport", "390", "844"]);
      for (const action of ACTIONS) {
        const duration = action === "attack" ? 3100 : action === "death" ? 2600 : 2500;
        clips.push(
          recordActionClip(
            browser,
            `knight-phone-${action}`,
            { action, camera: "phone", compareShipped: Boolean(shippedServer) },
            duration,
          ),
        );
      }

      const stats = JSON.parse(browser.run(["eval", "JSON.stringify(window.__troopMotionLab.getStats())"]));
      const summary = {
        capturedAt: new Date().toISOString(),
        comparedWithShipped: Boolean(shippedServer),
        clips,
        stats,
      };
      writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
      console.log(`Troop motion proof complete: ${clips.length} clips in ${out}`);
    } finally {
      browser.close();
      rmSync(profile, { recursive: true, force: true });
    }
  });
} finally {
  if (shippedServer) await shippedServer.close();
}
