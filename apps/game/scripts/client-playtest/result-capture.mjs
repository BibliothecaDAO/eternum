import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

/**
 * Proof that an action's result was on screen when the client marked it: the page's frames as the compositor produced
 * them (DevTools screencast), and in the result's region of the screen, the first frame that shows it.
 */

// A pixel counts as changed past this many grey levels (0–255), as frames.mjs counts a still view's changes.
const CHANGE_LEVELS = 8;
/** A result that changed less of its region than this by three frames after its mark was not shown there. */
const MIN_CHANGED_SHARE = 0.02;
/** Frames kept as evidence on each side of the one that first shows the result. */
const KEPT_AROUND = 3;
/** A target whose state the result sets (an explored tile) moved its mean grey less than this, did not change. */
const MIN_TARGET_CONTRAST = 16;

/** Starts recording the page's frames; the returned stop ends it and hands them back, each with the page time it shows. */
export async function startResultCapture(devTools, timeOrigin) {
  const frames = [];
  const stop = devTools.onEvent(({ method, params }) => {
    if (method !== "Page.screencastFrame") return;
    frames.push({
      t: params.metadata.timestamp * 1000 - timeOrigin,
      width: params.metadata.deviceWidth,
      jpeg: Buffer.from(params.data, "base64"),
    });
    void devTools.send("Page.screencastFrameAck", { sessionId: params.sessionId });
  });
  await devTools.send("Page.enable");
  await devTools.send("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 });
  return async () => {
    await devTools.send("Page.stopScreencast");
    stop();
    return frames;
  };
}

/**
 * Whether the captured frames show the result in `region` (CSS px of the page) at its mark (`visible`): the result's
 * pixels are those of the region that changed from the last frame before the action's facts arrived (`before`) to the
 * last frame, and already held their last value three frames after the mark (a later change there, the next orders'
 * highlights, is not this result). The screen at a moment is the last frame sent by then: a still page sends no frame
 * until it changes again. It was shown at the first frame where half of them did. The verdict fails when too
 * few pixels changed by then (the result was absent, or later than three frames), or when it was shown more than a frame
 * before its mark (the mark came late). The frames around it are written to `dir`.
 */
export async function proveResultOnScreen({ frames, region, target, onset, before, visible, frameMs, dir }) {
  if (target) return proveTargetState({ frames, target, onset, before, visible, frameMs, dir });
  const reference = frames.filter((frame) => frame.t < before).at(-1);
  const last = frames.at(-1);
  const settled = frames.filter((frame) => frame.t <= visible + 3 * frameMs).at(-1);
  if (!reference || !settled || settled === reference) {
    return { shown: false, reason: "no frame between the facts and three frames after the mark", region };
  }
  const [base, final, atSettled] = await Promise.all(
    [reference, last, settled].map((frame) => regionGrey(frame, region)),
  );
  const resultPixels = [];
  for (let index = 0; index < base.length; index += 1) {
    if (differs(base[index], final[index]) && !differs(atSettled[index], final[index])) resultPixels.push(index);
  }
  const resultShare = resultPixels.length / base.length;
  const verdict = { region, resultPercent: percent(resultShare) };
  if (resultShare < MIN_CHANGED_SHARE) {
    return {
      shown: false,
      reason: `three frames after its mark only ${percent(resultShare)}% of its region showed it`,
      ...verdict,
      kept: keepAround(frames, settled, reference, last, dir),
    };
  }
  let first = settled;
  for (const frame of frames.filter((candidate) => candidate.t > reference.t && candidate.t <= settled.t)) {
    const grey = await regionGrey(frame, region);
    const shown = resultPixels.filter((index) => !differs(grey[index], final[index])).length;
    if (shown >= resultPixels.length / 2) {
      first = frame;
      break;
    }
  }
  const lagMs = Math.round((first.t - visible) * 10) / 10;
  const kept = keepAround(frames, first, reference, last, dir);
  const shownAt = { ...verdict, firstShownAt: first.t, lagMs, kept };
  if (lagMs < -frameMs) return { shown: false, reason: `the screen showed it ${-lagMs}ms before its mark`, ...shownAt };
  return { shown: true, ...shownAt };
}

/**
 * Whether the frames show a target in the state the result sets (an explored tile's ground, not its fog): the target is
 * the box the result itself fills, so a change around it (an outline, a plate, the next orders) proves nothing. Its
 * state is its mean grey: from the last frame before the facts (`before`) to the last frame it must move by at least
 * MIN_TARGET_CONTRAST levels (an animated ground shimmers pixel by pixel, not in its mean), and it reads as changed
 * from the first frame past half that way, which must come no more than a frame before the mark (`visible`) and no
 * later than three frames after it. A result that sets its target moving (`onset`: a chest's lid lifting, which ends
 * seconds later with the chest gone) reads as changed from the first frame that has moved MIN_TARGET_CONTRAST levels
 * from the frame before the facts, whatever its last look.
 */
async function proveTargetState({ frames, target, onset = false, before, visible, frameMs, dir }) {
  const reference = frames.filter((frame) => frame.t < before).at(-1);
  const last = frames.at(-1);
  const settled = frames.filter((frame) => frame.t <= visible + 3 * frameMs).at(-1);
  if (!reference || !settled || settled === reference || last === reference) {
    return { shown: false, reason: "no frame between the facts and three frames after the mark", target };
  }
  const [from, to] = await Promise.all([reference, last].map((frame) => meanGrey(frame, target)));
  const verdict = { target, targetGrey: { before: Math.round(from), after: Math.round(to) } };
  if (!onset && Math.abs(to - from) < MIN_TARGET_CONTRAST) {
    const kept = keepAround(frames, settled, reference, last, dir);
    return {
      shown: false,
      reason: `its target never changed (mean grey ${verdict.targetGrey.before} to ${verdict.targetGrey.after})`,
      ...verdict,
      kept,
    };
  }
  const halfway = (from + to) / 2;
  const pastHalfway = onset
    ? (grey) => Math.abs(grey - from) >= MIN_TARGET_CONTRAST
    : (grey) => (to > from ? grey >= halfway : grey <= halfway);
  let first = null;
  for (const frame of frames.filter((candidate) => candidate.t > reference.t)) {
    if (pastHalfway(await meanGrey(frame, target))) {
      first = frame;
      break;
    }
  }
  const kept = keepAround(frames, first ?? settled, reference, last, dir);
  if (!first || first.t > settled.t) {
    return { shown: false, reason: "three frames after its mark its target still read as before", ...verdict, kept };
  }
  const lagMs = Math.round((first.t - visible) * 10) / 10;
  const shownAt = { ...verdict, firstShownAt: first.t, lagMs, kept };
  if (lagMs < -frameMs) return { shown: false, reason: `the screen showed it ${-lagMs}ms before its mark`, ...shownAt };
  return { shown: true, ...shownAt };
}

const meanGrey = async (frame, region) => {
  const grey = await regionGrey(frame, region);
  return grey.reduce((sum, value) => sum + value, 0) / grey.length;
};

const differs = (left, right) => Math.abs(left - right) > CHANGE_LEVELS;

/** The region's pixels in grey, the region held to the frame (a tile at the edge of a phone's screen runs past it). */
async function regionGrey(frame, region) {
  const { width, height } = await sharp(frame.jpeg).metadata();
  const scale = frame.width ? width / frame.width : 1;
  const left = Math.min(width - 1, Math.max(0, Math.round(region.left * scale)));
  const top = Math.min(height - 1, Math.max(0, Math.round(region.top * scale)));
  const box = {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round((region.left + region.width) * scale) - left)),
    height: Math.max(1, Math.min(height - top, Math.round((region.top + region.height) * scale) - top)),
  };
  return sharp(frame.jpeg).extract(box).greyscale().raw().toBuffer();
}

/** The reference, the last frame and the frames round the first that shows the result, written as evidence. */
function keepAround(frames, first, reference, last, dir) {
  const at = frames.indexOf(first);
  const kept = [reference, ...frames.slice(Math.max(0, at - KEPT_AROUND), at + KEPT_AROUND + 1), last];
  mkdirSync(dir, { recursive: true });
  return [...new Set(kept)].map((frame) => {
    const name = `t${Math.round(frame.t)}.jpg`;
    writeFileSync(join(dir, name), frame.jpeg);
    return name;
  });
}

const percent = (share) => Math.round(share * 1000) / 10;
