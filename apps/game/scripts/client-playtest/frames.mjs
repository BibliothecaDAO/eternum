import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

/**
 * The page's frames as the compositor produced them, and where they change from one to the next: what a still view
 * shimmers with (shadow edges, water, smoke, flags) shows as the pixels that keep changing on a camera that never moves.
 */

// A pixel counts as changed past this many grey levels (0–255): above PNG-exact noise, below a visible edge step.
const CHANGE_LEVELS = 8;

/** Records the page's frames for `durationMs` into `dir` as frame-NNNN.png, each acknowledged as it arrives. */
export async function recordFrames(devTools, owner, dir, durationMs) {
  mkdirSync(dir, { recursive: true });
  let count = 0;
  const stop = devTools.onEvent(({ method, params }) => {
    if (method !== "Page.screencastFrame") return;
    count += 1;
    writeFileSync(join(dir, `frame-${String(count).padStart(4, "0")}.png`), Buffer.from(params.data, "base64"));
    void devTools.send("Page.screencastFrameAck", { sessionId: params.sessionId });
  });
  await devTools.send("Page.enable");
  await devTools.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  try {
    await owner.sleep(durationMs);
  } finally {
    await devTools.send("Page.stopScreencast");
    stop();
  }
  return { frames: count, framesPerSecond: Math.round((count / durationMs) * 10_000) / 10 };
}

/**
 * How the recorded frames in `dir` change, in `region` ({left, top, width, height}) or the whole frame: for each pair of
 * consecutive frames the share of pixels that changed, and a map of how many pairs each pixel changed in (white: every
 * pair, black: none), written to `mapPath`.
 */
export async function measureFrameChanges(dir, mapPath, region = null) {
  const paths = readdirSync(dir)
    .filter((name) => /^frame-\d+\.png$/.test(name))
    .sort()
    .map((name) => join(dir, name));
  const grey = (path) =>
    (region ? sharp(path).extract(region) : sharp(path)).greyscale().raw().toBuffer({ resolveWithObject: true });
  let previous = null;
  let counts = null;
  let size = null;
  const shares = [];
  for (const path of paths) {
    const { data, info } = await grey(path);
    if (previous) {
      let changed = 0;
      for (let index = 0; index < data.length; index += 1) {
        if (Math.abs(data[index] - previous[index]) > CHANGE_LEVELS) {
          counts[index] += 1;
          changed += 1;
        }
      }
      shares.push(changed / data.length);
    } else {
      counts = new Uint16Array(data.length);
      size = { width: info.width, height: info.height };
    }
    previous = data;
  }
  if (!shares.length) return { frames: paths.length, pairs: 0 };
  const map = Buffer.from(Array.from(counts, (count) => Math.round((count / shares.length) * 255)));
  await sharp(map, { raw: { ...size, channels: 1 } })
    .png()
    .toFile(mapPath);
  return {
    frames: paths.length,
    pairs: shares.length,
    changedShare: summarizeShares(shares),
    changedPairs: changedPairs(shares),
  };
}

const summarizeShares = (shares) => {
  const sorted = [...shares].sort((a, b) => a - b);
  const percent = (value) => Math.round(value * 1_000_000) / 10_000;
  return {
    medianPercent: percent(sorted[Math.floor(sorted.length / 2)]),
    maxPercent: percent(sorted.at(-1)),
    meanPercent: percent(shares.reduce((sum, share) => sum + share, 0) / shares.length),
  };
};

/** How many consecutive pairs changed at all: a view redrawn only now and then changes in few of them. */
const changedPairs = (shares) => shares.filter((share) => share > 0).length;
