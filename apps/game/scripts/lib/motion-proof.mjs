import { execFileSync } from "node:child_process";
import { statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export function parseOption(key, fallback) {
  return process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback;
}

export function transcodeClip(webmPath, mp4Path) {
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
  const { size } = statSync(mp4Path);
  if (size < 1024) {
    throw new Error(`Recorded clip ${mp4Path} is unexpectedly small (${size} bytes)`);
  }
}

export function recordClip(browser, out, name, bridgeName, state, durationMs, fps = 24) {
  const webmPath = join(out, `${name}.webm`);
  const mp4Path = join(out, `${name}.mp4`);
  browser.run(["eval", `window.${bridgeName}.setState(${JSON.stringify(state)})`]);
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

export function assertBrowserClean(browser, bridgeName) {
  const errors = browser.run(["errors"]);
  if (errors.trim()) throw new Error(`Browser errors during proof:\n${errors}`);
  const stats = browser.read(`window.${bridgeName}.getStats()`);
  if (!stats || !(stats.drawCalls > 0) || !(stats.triangles > 0)) {
    throw new Error(`Renderer produced empty frame stats: ${JSON.stringify(stats)}`);
  }
  return stats;
}
